import {env} from 'cloudflare:workers';
import {GameError,normalizeState,type GameState,type Member} from '@/lib/game';
import {visibleState} from '@/lib/world';
import {publicSession,type SessionState} from '@/lib/session';
export type StoredMember=Member&{recoveryHash?:string;accountHash?:string};
export type RoomRow={code:string;revision:number;state_json:string};
export const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export function database(){if(!env.DB)throw new GameError('Campaign storage is unavailable.',503);return env.DB;}
export function roomCode(value:unknown){if(typeof value!=='string'||!/^[A-Z2-9]{6}$/.test(value.toUpperCase().trim()))throw new GameError('Enter the six-character table code.');return value.toUpperCase().trim();}
export async function digest(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function secret(){return [...crypto.getRandomValues(new Uint8Array(32))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function generateCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return [...crypto.getRandomValues(new Uint8Array(6))].map(n=>chars[n%chars.length]).join('');}
export async function accountHash(request:Request){if((env as typeof env&{HEARTHBOUND_LOCAL_MODE?:string}).HEARTHBOUND_LOCAL_MODE==='true')return undefined;const id=request.headers.get('oai-authenticated-user-id');return id?digest('hearthbound-account:'+id):undefined;}
export async function getRoom(code:string){const row=await database().prepare('SELECT code, revision, state_json FROM game_rooms WHERE code = ?').bind(code).first<RoomRow>();if(!row)throw new GameError('That table was not found.',404);return {row,state:normalizeState(JSON.parse(row.state_json) as GameState)};}
export async function identity(request:Request,state:GameState):Promise<StoredMember>{const auth=request.headers.get('Authorization')??'';if(!/^Bearer [a-f0-9]{64}$/.test(auth))throw new GameError('Join this table to continue.',401);const hash=await digest(auth.slice(7));const member=state.members.find(m=>m.tokenHash===hash);if(!member)throw new GameError('This session does not have access to that table.',403);return member;}
export function snapshot(state:GameState,member:Member){const me={id:member.id,name:member.name,role:member.role,...(member.characterId?{characterId:member.characterId}:{})};const visible=visibleState(state,member) as SessionState;visible.session=publicSession(state);return {room:state.room,state:visible,me};}
export async function save(state:GameState,revision:number){state.revision=revision+1;const r=await database().prepare('UPDATE game_rooms SET state_json = ?, revision = ?, updated_at = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(state),state.revision,new Date().toISOString(),state.room,revision).run();return r.meta.changes===1;}
export function failure(error:unknown){if(error instanceof GameError)return reply({error:error.message},error.status);console.error('Campaign request failed',error instanceof Error?error.message:'Unknown error');return reply({error:'The table could not be updated. Please retry.'},500);}
export async function jsonBody(request:Request):Promise<Record<string,unknown>>{const raw=await request.text();if(raw.length>32000)throw new GameError('That request is too large.',413);try{const data=JSON.parse(raw);if(!data||typeof data!=='object'||Array.isArray(data))throw new Error();return data;}catch{throw new GameError('Invalid request.');}}
