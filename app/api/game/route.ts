import {GameError,addPlayer,cleanText,createInitialState,type Action} from '@/lib/game';
import {accountHash,database,digest,failure,generateCode,getRoom,identity,jsonBody,reply,roomCode,save,secret,snapshot,type StoredMember} from '@/lib/campaign-store';
import {applyWorldAction,applyVisibleAction} from '@/lib/world';
import {applySessionAction,campaignArchive,requireGm,requireJoinAccess,rotateInvitation} from '@/lib/session';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{
 const url=new URL(request.url),{state}=await getRoom(roomCode(url.searchParams.get('room'))),member=await identity(request,state);
 if(url.searchParams.get('download')==='campaign'){
  const archive=JSON.stringify(campaignArchive(state,member),null,2);
  if(new TextEncoder().encode(archive).length>2_000_000)throw new GameError('This campaign is too large for an archive download.',413);
  return new Response(archive,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="hearthbound-${state.room}.json"`,'Cache-Control':'no-store'}});
 }
 return reply(snapshot(state,member));
}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const body=await jsonBody(request);
 if(body.type==='create'){
  if(body.requireInvite!==undefined&&typeof body.requireInvite!=='boolean')throw new GameError('Choose whether an invitation is required.');
  const ruleSetId=body.ruleSetId??'srd-5.2.1';if(!['srd-5.1','srd-5.2.1'].includes(String(ruleSetId)))throw new GameError('Choose an official SRD ruleset.');
  const token=secret(),recoveryCode=secret(),inviteCode=body.requireInvite?secret():undefined,inviteHash=inviteCode?await digest(inviteCode):undefined;const member:StoredMember={id:crypto.randomUUID(),name:cleanText(body.name,30)||'Game Master',role:'gm',tokenHash:await digest(token),recoveryHash:await digest(recoveryCode),accountHash:await accountHash(request)};
  for(let n=0;n<5;n++){const code=generateCode(),state=createInitialState(code,member,ruleSetId as 'srd-5.1'|'srd-5.2.1');if(inviteHash)rotateInvitation(state,member,inviteHash);const result=await database().prepare('INSERT INTO game_rooms (code, revision, state_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(code) DO NOTHING').bind(code,0,JSON.stringify(state),new Date().toISOString()).run();if(result.meta.changes===1)return reply({...snapshot(state,member),token,recoveryCode,...(inviteCode?{inviteCode}:{})},201);}
  throw new GameError('Could not create a table. Please retry.',503);
 }
 if(body.type==='join'){
  const code=roomCode(body.room),name=cleanText(body.name,30);if(!name)throw new GameError('Give your character a name.');
  const suppliedInvite=typeof body.inviteCode==='string'?body.inviteCode.trim():'',inviteHash=/^[a-f0-9]{64}$/.test(suppliedInvite)?await digest(suppliedInvite):undefined;
  const token=secret(),recoveryCode=secret(),hash=await digest(token),recoveryHash=await digest(recoveryCode),account=await accountHash(request),memberId=crypto.randomUUID();
  for(let attempt=0;attempt<6;attempt++){const {row,state}=await getRoom(code);requireJoinAccess(state,inviteHash);const member:StoredMember={id:memberId,name,role:'player',tokenHash:hash,recoveryHash,accountHash:account};addPlayer(state,member,body.characterClass??'fighter');if(await save(state,row.revision))return reply({...snapshot(state,member),token,recoveryCode},201);}
  throw new GameError('The table is busy. Try joining again.',409);
 }
 if(body.type==='invite'){
  const code=roomCode(body.room),inviteCode=secret(),hash=await digest(inviteCode);
  for(let attempt=0;attempt<6;attempt++){
   const {row,state}=await getRoom(code),member=await identity(request,state);requireGm(member);rotateInvitation(state,member,hash);
   if(await save(state,row.revision))return reply({...snapshot(state,member),inviteCode});
  }
  throw new GameError('The table changed while creating the invitation. Please retry.',409);
 }
 if(body.type==='recover'||body.type==='recoveryCode'){
  const code=roomCode(body.room),provided=typeof body.recoveryCode==='string'?body.recoveryCode.trim():'';
  const hash=provided?await digest(provided):undefined,account=await accountHash(request);
  if(body.type==='recover'&&!hash&&!account)throw new GameError('Enter your private recovery code, or sign in with the account originally linked to this table.',401);
  for(let attempt=0;attempt<6;attempt++){
   const {row,state}=await getRoom(code);let member:StoredMember|undefined;
   if(body.type==='recoveryCode')member=await identity(request,state);
   else {const matches=(state.members as StoredMember[]).filter(m=>hash?m.recoveryHash===hash:m.accountHash===account);if(matches.length===1)member=matches[0];}
   if(!member)throw new GameError('This recovery method could not identify a single seat at that table. Use its private recovery code.',403);
   const token=secret(),recoveryCode=secret();member.tokenHash=await digest(token);member.recoveryHash=await digest(recoveryCode);if(account)member.accountHash=account;
   if(await save(state,row.revision))return reply({...snapshot(state,member),token,recoveryCode});
  }
  throw new GameError('The table changed during recovery. Please retry.',409);
 }
 if(body.type==='action'){
  const code=roomCode(body.room),action=body.action as Action;if(!action||typeof action!=='object'||Array.isArray(action))throw new GameError('An action is required.');
  for(let attempt=0;attempt<6;attempt++){
   const {row,state}=await getRoom(code),member=await identity(request,state);
   if(state.processed?.some(a=>a.id===action.id&&a.memberId===member.id))return reply(snapshot(state,member));
   if(action.type==='session')applySessionAction(state,member,action);else if(action.type==='world')applyWorldAction(state,member,action);else applyVisibleAction(state,member,action);
   if(await save(state,row.revision))return reply(snapshot(state,member));
  }
  throw new GameError('Another player acted at the same time. Please retry.',409);
 }
 throw new GameError('Unknown request.');
}catch(e){return failure(e);}}
