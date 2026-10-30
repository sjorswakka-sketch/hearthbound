// @ts-ignore Native Node test imports.
import { ABILITIES, SKILLS, CONDITIONS, CLASS_PROFILES, makeSheet, derivedStats, modifier, newTurn } from './characters.ts';
import type { Ability, Abilities, CharacterClass } from './characters';
import type { Action, GameState, Member, Token } from './game';
type DiceLog={die:(sides:number)=>number;log:(state:GameState,kind:string,text:string)=>void};
type Helpers=DiceLog&{fail:(message:string,status?:number)=>never;requireGm:(member:Member)=>void;requireTurn:(state:GameState,token:Token)=>void;controlledToken:(state:GameState,member:Member,id:unknown)=>Token};

export function incapacitated(token:Token){return token.sheet?.deathSaves.dead||token.sheet?.conditions.some(c=>['incapacitated','paralyzed','petrified','stunned','unconscious'].includes(c))||false;}
export function effectiveSpeed(state:GameState,token:Token){
 if(token.hp<=0)return 0;
 const s=token.sheet;if(!s)return token.speed;
 if(incapacitated(token)||s.conditions.some(c=>['grappled','restrained'].includes(c)))return 0;
 let speed=token.speed;
 if(state.ruleSetId==='srd-5.2.1')speed=Math.max(0,speed-5*s.exhaustion);
 else if(s.exhaustion>=5)speed=0;else if(s.exhaustion>=2)speed=Math.floor(speed/2);
 return speed;
}
export function movementAllowance(state:GameState,token:Token){return Math.min(effectiveSpeed(state,token),state.rules.movementLimit)*(1+(token.turn?.dashes??0));}
export function syncMovement(state:GameState,token:Token,previousAllowance=movementAllowance(state,token)){
 if(incapacitated(token)||effectiveSpeed(state,token)===0)token.turn!.dodging=false;
 if(!state.combat.active||state.combat.order[state.combat.turnIndex]!==token.id)return;
 // Keep distance already spent even while speed is temporarily zero, so ending
 // a grapple never refunds earlier movement. Dash changes with current speed.
 token.turn!.movementSpent??=Math.max(0,previousAllowance-state.combat.remainingMovement);
 state.combat.remainingMovement=Math.max(0,movementAllowance(state,token)-token.turn!.movementSpent);
}
export function spendMovement(state:GameState,token:Token,distance:number){
 if(!state.combat.active)return;
 token.turn!.movementSpent??=Math.max(0,movementAllowance(state,token)-state.combat.remainingMovement);
 token.turn!.movementSpent+=distance;state.combat.remainingMovement-=distance;
}
export function rollD20(die:(n:number)=>number,mode=0){const a=die(20);if(!mode)return a;const b=die(20);return mode>0?Math.max(a,b):Math.min(a,b);}
export function attackAdvantage(state:GameState,actor:Token,target:Token){
 const a=actor.sheet!,b=target.sheet!; const close=Math.max(Math.abs(actor.x-target.x),Math.abs(actor.y-target.y))<=1;
 const advantage=a.conditions.includes('invisible')||b.conditions.some(c=>['blinded','paralyzed','restrained','stunned','unconscious'].includes(c))||(b.conditions.includes('prone')&&close);
 const disadvantage=a.conditions.some(c=>['blinded','poisoned','prone','restrained'].includes(c))||b.conditions.includes('invisible')||(b.conditions.includes('prone')&&!close)||(!!target.turn?.dodging&&!incapacitated(target)&&effectiveSpeed(state,target)>0&&!b.conditions.includes('blinded')&&!a.conditions.includes('invisible'))||(state.ruleSetId!=='srd-5.2.1'&&a.exhaustion>=3);
 return advantage===disadvantage?0:advantage?1:-1;
}
export function saveModifier(state:GameState,token:Token,ability:Ability){const s=token.sheet!;return modifier(s.abilities[ability])+(s.saveProficiencies.includes(ability)?s.proficiency:0)-(state.ruleSetId==='srd-5.2.1'?2*s.exhaustion:0);}
export function changeHitPoints(state:GameState,token:Token,amount:number,h:DiceLog,critical=false){
 const sheet=token.sheet!;
 if(sheet.deathSaves.dead)return;
 const old=token.hp,previousMovement=movementAllowance(state,token),damage=Math.max(0,-amount),cap=state.ruleSetId==='srd-5.1'&&sheet.exhaustion>=4?Math.floor(token.maxHp/2):token.maxHp;
 token.hp=Math.max(0,Math.min(cap,token.hp+amount));
 if(damage&&old===0){sheet.deathSaves.stable=false;sheet.deathSaves.failures=Math.min(3,sheet.deathSaves.failures+(critical?2:1));}
 if(damage&&damage-old>=cap){sheet.deathSaves.dead=true;sheet.deathSaves.failures=3;}
 if(sheet.deathSaves.failures>=3)sheet.deathSaves.dead=true;
 if(token.hp===0){if(!sheet.conditions.includes('unconscious'))sheet.conditions.push('unconscious');sheet.concentration=undefined;}
 else if(amount>0){sheet.deathSaves={successes:0,failures:0,stable:false,dead:false};if(old===0)sheet.conditions=sheet.conditions.filter(c=>c!=='unconscious');}
 if(damage&&sheet.concentration){
  const dc=Math.min(state.ruleSetId==='srd-5.2.1'?30:Infinity,Math.max(10,Math.floor(damage/2))),roll=rollD20(h.die,state.ruleSetId==='srd-5.1'&&sheet.exhaustion>=3?-1:0),total=roll+saveModifier(state,token,'con');
  h.log(state,'check',`${token.name}: concentration save ${total} vs DC ${dc} — ${total>=dc?'maintained':'lost'}.`);
  if(total<dc)sheet.concentration=undefined;
 }
 if(sheet.deathSaves.dead)h.log(state,'combat',`${token.name} has died. Revival requires a GM ruling.`);
 syncMovement(state,token,previousMovement);
}
function text(value:unknown,max:number,h:Helpers,empty=true){if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))h.fail(`Enter text up to ${max} characters.`);return (value as string).trim();}
function number(value:unknown,min:number,max:number,h:Helpers){if(typeof value!=='number'||!Number.isInteger(value)||value<min||value>max)h.fail(`Enter a whole number from ${min} to ${max}.`);return value as number;}
function owned(state:GameState,member:Member,id:unknown,h:Helpers){const token=state.tokens.find(t=>t.id===id);if(!token)h.fail('Character not found.',404);if(member.role!=='gm'&&token!.ownerId!==member.id)h.fail('You can only control your own character.',403);return token!;}
function recoverySpace(state:GameState,token:Token,h:Helpers){if(state.tokens.some(other=>other.id!==token.id&&other.x===token.x&&other.y===token.y))h.fail('Move the other creature out of this space before resolving recovery or a death save.');}
function useAction(state:GameState,token:Token,kind:string,h:Helpers){
 if(!state.combat.active)return;
 if(kind==='reaction'){if(token.turn!.reactionUsed)h.fail('Your reaction has already been used.');return;}
 h.requireTurn(state,token);
 if(kind==='bonus'){if(token.turn!.bonusUsed)h.fail('Your bonus action has already been used.');}
 else if(state.combat.actionUsed)h.fail('This character already used their action.');
}
function spendAction(state:GameState,token:Token,kind:string){if(!state.combat.active)return;if(kind==='reaction')token.turn!.reactionUsed=true;else if(kind==='bonus')token.turn!.bonusUsed=true;else state.combat.actionUsed=true;}

export function applyExpandedAction(state:GameState,member:Member,action:Action,h:Helpers):boolean{
 switch(action.type){
 case 'character':{
  const token=owned(state,member,action.tokenId,h);
  const mechanical=action.level!==undefined||action.abilities!==undefined||action.skills!==undefined;
  if(state.combat.active&&mechanical)h.fail('Character setup is locked during combat.');
  if(mechanical){h.requireGm(member);const level=number(action.level??token.sheet!.level,1,20,h);let abilities={...token.sheet!.abilities};
   if(action.abilities!==undefined){if(!action.abilities||typeof action.abilities!=='object')h.fail('Supply all six ability scores.');abilities=Object.fromEntries(ABILITIES.map(a=>[a,number((action.abilities as Abilities)[a],3,30,h)])) as Abilities;}
   const rebuilt=makeSheet(token.characterClass,state.ruleSetId!,level,abilities),previous=token.sheet!;
   rebuilt.notes=previous.notes;rebuilt.inventory=previous.inventory;
   if(action.skills!==undefined){if(!Array.isArray(action.skills)||action.skills.some(s=>typeof s!=='string'||!Object.hasOwn(SKILLS,s)))h.fail('Choose valid skills.');rebuilt.skills=[...new Set(action.skills)] as string[];}
   token.sheet=rebuilt;Object.assign(token,derivedStats(token.characterClass,rebuilt));
   h.log(state,'system',`GM rebuilt ${token.name}'s level ${level} sheet; resources reset. Confirm origin bonuses, features and equipment in the SRD.`);
  }
  if(action.inventory!==undefined){if(!Array.isArray(action.inventory)||action.inventory.length>100)h.fail('Use at most 100 inventory entries.');token.sheet!.inventory=action.inventory.map(item=>{if(!item||typeof item!=='object')h.fail('Invalid inventory item.');return{name:text(item.name,120,h,false),quantity:number(item.quantity,0,9999,h)};});}
  if(action.statistics!==undefined){h.requireGm(member);if(!action.statistics||typeof action.statistics!=='object'||Array.isArray(action.statistics))h.fail('Supply character statistics.');const values=action.statistics as Record<string,unknown>,reason=text(action.reason,300,h,false),previousMovement=movementAllowance(state,token);
   const limits:Record<string,[number,number]>={ac:[0,40],maxHp:[1,2000],speed:[0,300],attackBonus:[-10,30],damageDie:[1,100],range:[1,120]};
   for(const [key,[min,max]] of Object.entries(limits))if(values[key]!==undefined)(token as unknown as Record<string,unknown>)[key]=number(values[key],min,max,h);
   if(values.damageModifier!==undefined)token.sheet!.damageModifier=number(values.damageModifier,-20,50,h);
   token.hp=Math.min(token.hp,token.maxHp);
   syncMovement(state,token,previousMovement);
   h.log(state,'system',`GM adjusted ${token.name}'s statistics: ${reason}. GM must remove temporary changes when they expire.`);
  }
  if(action.notes!==undefined)token.sheet!.notes=text(action.notes,4000,h);
  h.log(state,'sheet',`${token.name}'s character sheet was updated.`);return true;
 }
 case 'check':{
  const token=owned(state,member,action.tokenId,h),s=token.sheet!;const ability=action.ability as Ability;if(!ABILITIES.includes(ability))h.fail('Choose an ability.');
  const skill=action.skill as string|undefined,kind=action.kind??'ability';if(!['ability','save'].includes(String(kind)))h.fail('Choose an ability check or saving throw.');
  if(skill&&(!Object.hasOwn(SKILLS,skill)||SKILLS[skill]!==ability))h.fail('The skill must match the selected ability.');
  const mode=action.advantage??'normal';if(!['normal','advantage','disadvantage'].includes(String(mode)))h.fail('Choose normal, advantage or disadvantage.');
  let adv=mode==='advantage',dis=mode==='disadvantage';
  if(kind==='ability'&&(s.conditions.includes('poisoned')||(state.ruleSetId==='srd-5.1'&&s.exhaustion>=1)))dis=true;
  if(kind==='save'&&state.ruleSetId==='srd-5.1'&&s.exhaustion>=3)dis=true;
  if(kind==='save'&&ability==='dex'&&token.turn?.dodging&&!incapacitated(token)&&effectiveSpeed(state,token)>0)adv=true;
  if(kind==='save'&&['str','dex'].includes(ability)&&s.conditions.some(c=>['paralyzed','petrified','stunned','unconscious'].includes(c))){h.log(state,'check',`${token.name} automatically fails the ${ability.toUpperCase()} save due to a condition.`);return true;}
  const bonus=kind==='save'?saveModifier(state,token,ability):modifier(s.abilities[ability])+(skill&&s.skills.includes(skill)?s.proficiency:0)-(state.ruleSetId==='srd-5.2.1'?2*s.exhaustion:0);
  const roll=rollD20(h.die,adv===dis?0:adv?1:-1);h.log(state,'check',`${token.name}: ${skill||ability.toUpperCase()} ${kind==='save'?'save':'check'} — d20 ${roll} ${bonus>=0?'+':'−'} ${Math.abs(bonus)} = ${roll+bonus}. GM compares the result to the DC.`);return true;
 }
 case 'maneuver':{
  const token=h.controlledToken(state,member,action.tokenId);const mode=String(action.mode);if(!['dash','dodge','disengage','help','ready','bonus','reaction','stand'].includes(mode))h.fail('Choose a supported action.');
  if(!state.combat.active)h.fail('Start an encounter to track turn actions.');
  if(mode==='stand'){h.requireTurn(state,token);if(!token.sheet!.conditions.includes('prone'))h.fail('This character is not prone.');const cost=Math.floor(effectiveSpeed(state,token)/2);if(cost===0||state.combat.remainingMovement<cost)h.fail('Not enough movement to stand.');spendMovement(state,token,cost);token.sheet!.conditions=token.sheet!.conditions.filter(c=>c!=='prone');}
  else{useAction(state,token,mode==='bonus'?'bonus':mode==='reaction'?'reaction':'action',h);spendAction(state,token,mode==='bonus'?'bonus':mode==='reaction'?'reaction':'action');
   if(mode==='dash'){const previous=movementAllowance(state,token);token.turn!.movementSpent??=Math.max(0,previous-state.combat.remainingMovement);token.turn!.dashes=(token.turn!.dashes??0)+1;syncMovement(state,token,previous);}
   if(mode==='dodge')token.turn!.dodging=effectiveSpeed(state,token)>0;if(mode==='disengage')token.turn!.disengaged=true;if(mode==='help')token.turn!.helping=true;if(mode==='ready')token.turn!.ready=true;
  }
  h.log(state,'combat',`${token.name}: ${mode}.${['help','ready','bonus','reaction'].includes(mode)?' GM resolves the trigger and effect using the selected rules.':''}`);return true;
 }
 case 'condition':{
  h.requireGm(member);const token=owned(state,member,action.tokenId,h),previousMovement=movementAllowance(state,token),condition=String(action.condition);if(!CONDITIONS.includes(condition as typeof CONDITIONS[number])||typeof action.enabled!=='boolean')h.fail('Choose a supported condition and on/off value.');
  token.sheet!.conditions=token.sheet!.conditions.filter(c=>c!==condition);if(action.enabled)token.sheet!.conditions.push(condition);
  if(incapacitated(token))token.sheet!.concentration=undefined;
  syncMovement(state,token,previousMovement);
  h.log(state,'condition',`GM ${action.enabled?'applies':'removes'} ${condition} ${action.enabled?'to':'from'} ${token.name}.`);return true;
 }
 case 'exhaustion':{
  h.requireGm(member);const token=owned(state,member,action.tokenId,h),previousMovement=movementAllowance(state,token);token.sheet!.exhaustion=number(action.level,0,6,h);
  if(token.sheet!.exhaustion===6){token.hp=0;token.sheet!.deathSaves.dead=true;token.sheet!.concentration=undefined;}
  if(state.ruleSetId==='srd-5.1'&&token.sheet!.exhaustion>=4)token.hp=Math.min(token.hp,Math.floor(token.maxHp/2));
  syncMovement(state,token,previousMovement);
  h.log(state,'condition',`${token.name}: exhaustion level ${token.sheet!.exhaustion}.`);return true;
 }
 case 'adjustHp':{
  h.requireGm(member);const token=owned(state,member,action.tokenId,h),amount=number(action.amount,-10000,10000,h),reason=text(action.reason,300,h,false);if(token.sheet!.deathSaves.dead)h.fail('This character is dead. A revival ruling is required.');
  if(token.hp===0&&amount>0)recoverySpace(state,token,h);
  changeHitPoints(state,token,amount,h);h.log(state,'combat',`GM: ${token.name} ${amount>=0?'recovers':'takes'} ${Math.abs(amount)} HP — ${reason}.`);return true;
 }
 case 'revive':{
  h.requireGm(member);const token=owned(state,member,action.tokenId,h),reason=text(action.reason,300,h,false);
  recoverySpace(state,token,h);const previousMovement=movementAllowance(state,token);
  if(token.sheet!.exhaustion>=6)h.fail('Resolve lethal exhaustion before reviving this character.');
  token.sheet!.deathSaves={successes:0,failures:0,stable:false,dead:false};token.sheet!.conditions=token.sheet!.conditions.filter(c=>c!=='unconscious');token.hp=1;
  syncMovement(state,token,previousMovement);
  h.log(state,'story',`GM revival ruling for ${token.name}: ${reason}. Appropriate spell costs and restrictions are GM-adjudicated.`);return true;
 }
 case 'deathSave':{
  const token=owned(state,member,action.tokenId,h),s=token.sheet!;if(token.hp!==0||s.deathSaves.dead||s.deathSaves.stable)h.fail('Death saves apply only to an unstable, dying character.');h.requireTurn(state,token);if(state.combat.active&&token.turn!.deathSaveRolled)h.fail('This turn already has a death saving throw.');
  recoverySpace(state,token,h);
  const raw=rollD20(h.die,state.ruleSetId==='srd-5.1'&&s.exhaustion>=3?-1:0),total=raw-(state.ruleSetId==='srd-5.2.1'?2*s.exhaustion:0);token.turn!.deathSaveRolled=true;
  if(raw===20)changeHitPoints(state,token,1,h);else{if(raw===1)s.deathSaves.failures+=2;else if(total>=10)s.deathSaves.successes++;else s.deathSaves.failures++;if(s.deathSaves.failures>=3){s.deathSaves.failures=3;s.deathSaves.dead=true;}else if(s.deathSaves.successes>=3){s.deathSaves={successes:0,failures:0,stable:true,dead:false};}}
  h.log(state,'combat',`${token.name}: death save d20 ${raw}${total!==raw?` (${total} after exhaustion)`:''}. ${token.hp>0?'Regains 1 HP.':s.deathSaves.dead?'Dead.':s.deathSaves.stable?'Stable.':`${s.deathSaves.successes} successes, ${s.deathSaves.failures} failures.`}`);return true;
 }
 case 'cast':{
  const token=h.controlledToken(state,member,action.tokenId),s=token.sheet!,turn=token.turn!,spell=text(action.spellName,120,h,false),slot=number(action.slotLevel,0,9,h),casting=String(action.castingTime??'action');
  if(!['action','bonus','reaction'].includes(casting))h.fail('Use action, bonus or reaction. Longer casting is GM-adjudicated.');
  if(typeof action.concentration!=='boolean')h.fail('Specify whether the spell needs concentration.');
  if(!s.spellAbility&&member.role!=='gm')h.fail('Your class has no spellcasting profile. Ask the GM to resolve a feat or item spell.');
  useAction(state,token,casting,h);
  const pact=action.usePact===true; if(slot>0){if(pact){if(slot!==s.pactSlotLevel||s.pactSlots<1)h.fail('No pact slot of that level is available.');}else if(!s.spellSlots[slot-1])h.fail('No spell slot of that level remains.');}
  if(state.combat.active){
   if(state.ruleSetId==='srd-5.2.1'&&slot>0&&turn.slotSpent)h.fail('2024 rules allow only one spell slot to be spent to cast a spell per turn.');
   if(state.ruleSetId==='srd-5.1'&&((casting==='bonus'&&turn.otherSpellCast)||(turn.bonusSpellCast&&!(slot===0&&casting==='action'))))h.fail('2014 bonus-action spell rule: other spells this turn must be action cantrips.');
  }
  if(slot>0){if(pact)s.pactSlots--;else s.spellSlots[slot-1]--;}
  spendAction(state,token,casting);
  if(state.combat.active){if(slot>0)turn.slotSpent=true;if(casting==='bonus')turn.bonusSpellCast=true;if(slot>0)turn.nonCantripCast=true;if(casting==='reaction'||slot>0)turn.otherSpellCast=true;}
  if(action.concentration){if(s.concentration)h.log(state,'spell',`${token.name} ends concentration on ${s.concentration}.`);s.concentration=spell;}
  h.log(state,'spell',`${token.name} casts ${spell} (${slot?`level ${slot}${pact?' pact':''} slot`:'cantrip'}, ${casting}${action.concentration?', concentration':''}). Resources spent; GM verifies preparation, components, targets, range, triggers and resolves the spell's effects from ${state.ruleSetId}. Slot-free leveled spells require a separate GM ruling.`);return true;
 }
 case 'endConcentration':{
  const token=owned(state,member,action.tokenId,h);if(!token.sheet!.concentration)h.fail('No concentration effect is active.');h.log(state,'spell',`${token.name} ends concentration on ${token.sheet!.concentration}.`);token.sheet!.concentration=undefined;return true;
 }
 case 'rest':{
  if(state.ruleSetId==='prototype'&&action.mode===undefined)return false;
  h.requireGm(member);if(state.combat.active)h.fail('End combat before resting.');const mode=action.mode??'long';if(!['short','long'].includes(String(mode)))h.fail('Choose a short or long rest.');
  const tokens=action.tokenId?[owned(state,member,action.tokenId,h)]:state.tokens.filter(t=>t.kind==='hero');
  for(const token of tokens){const s=token.sheet!;if(token.hp<=0||s.deathSaves.dead){h.log(state,'story',`${token.name} cannot benefit from this rest at 0 HP.`);continue;}
   if(mode==='long'){s.exhaustion=Math.max(0,s.exhaustion-1);token.hp=state.ruleSetId==='srd-5.1'&&s.exhaustion>=4?Math.floor(token.maxHp/2):token.maxHp;s.spellSlots=[...s.maxSpellSlots];s.pactSlots=s.maxPactSlots;s.hitDice=Math.min(s.level,s.hitDice+(state.ruleSetId==='srd-5.1'?Math.max(1,Math.floor(s.level/2)):s.level));s.concentration=undefined;token.turn=newTurn();}
   else{const count=number(action.hitDice??0,0,s.hitDice,h);for(let n=0;n<count;n++)changeHitPoints(state,token,Math.max(0,h.die(s.hitDie)+modifier(s.abilities.con)),h);s.hitDice-=count;s.pactSlots=s.maxPactSlots;}
  }
  h.log(state,'story',`GM grants a ${mode} rest. Time, safety, daily limits and other feature recovery are GM-adjudicated.`);return true;
 }
 default:return false;
 }
}
