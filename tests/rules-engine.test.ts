import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Native Node tests.
import {createInitialState,normalizeState,addPlayer,applyAction} from '../lib/game.ts';
// @ts-ignore Native Node tests.
import {CHARACTER_CLASSES,makeSheet,slotTable,modifier} from '../lib/characters.ts';
// @ts-ignore Native Node tests.
import {effectiveSpeed,changeHitPoints,saveModifier,applyExpandedAction,attackAdvantage} from '../lib/rules-engine.ts';
import type {GameState,Member,Action} from '../lib/game';
const gm:Member={id:'gm',name:'GM',role:'gm'};
const act=(s:GameState,type:string,fields:Record<string,unknown>={},member=gm)=>applyAction(s,member,{id:crypto.randomUUID(),type,...fields} as Action);
function wizard(edition:'srd-5.1'|'srd-5.2.1'){
 const s=createInitialState('TEST23',gm,edition),p:Member={id:'player',name:'Arin',role:'player'};addPlayer(s,p,'wizard');
 const t=s.tokens.find(t=>t.id===p.characterId)!;act(s,'combat',{mode:'start'});s.combat.order=[t.id,...s.tokens.filter(x=>x.id!==t.id).map(x=>x.id)];s.combat.turnIndex=0;s.combat.actionUsed=false;return {s,t,p};
}
test('editions are pinned and legacy normalization never changes existing statistics',()=>{
 const s=createInitialState('TEST23',gm);delete s.ruleSetId;s.tokens[0].maxHp=47;s.tokens[0].hp=21;normalizeState(s);assert.equal(s.ruleSetId,'prototype');assert.equal(s.tokens[0].maxHp,47);assert.equal(s.tokens[0].hp,21);
 assert.throws(()=>createInitialState('TEST23',gm,'other' as never));
});
test('all twelve single-class profiles have complete standard arrays and scaling resources',()=>{
 for(const c of CHARACTER_CLASSES){const a=makeSheet(c,'srd-5.2.1',20);assert.deepEqual(Object.values(a.abilities).sort((a,b)=>a-b),[8,10,12,13,14,15]);assert.equal(a.proficiency,6);assert.equal(a.hitDice,20);assert.equal(a.spellSlots.length,9);}
 assert.deepEqual(slotTable('wizard',20,'srd-5.1'),[4,3,3,3,3,2,2,1,1]);
 assert.equal(slotTable('paladin',1,'srd-5.1')[0],0);assert.equal(slotTable('paladin',1,'srd-5.2.1')[0],2);
});
test('2014 and 2024 exhaustion apply different speed and save effects',()=>{
 const old=createInitialState('TEST23',gm,'srd-5.1'),modern=createInitialState('TEST24',gm,'srd-5.2.1');
 for(const s of [old,modern])act(s,'exhaustion',{tokenId:s.tokens[0].id,level:2});
 assert.equal(effectiveSpeed(old,old.tokens[0]),15);assert.equal(effectiveSpeed(modern,modern.tokens[0]),20);
 assert.equal(saveModifier(modern,modern.tokens[0],'con'),saveModifier(old,old.tokens[0],'con')-4);
});
test('players cannot rebuild statistics or restore their resources',()=>{
 const {s,t,p}=wizard('srd-5.2.1');act(s,'combat',{mode:'end'});
 assert.throws(()=>act(s,'character',{tokenId:t.id,level:20},p),/Only the GM/);
 act(s,'character',{tokenId:t.id,notes:'My character history'},p);assert.equal(t.sheet!.notes,'My character history');
 assert.throws(()=>act(s,'rest',{mode:'long'},p),/Only the GM/);
});
test('2024 casting uses one slot per creature turn and tracks bonus actions',()=>{
 const {s,t,p}=wizard('srd-5.2.1');act(s,'cast',{tokenId:t.id,spellName:'GM-reviewed spell',slotLevel:1,castingTime:'bonus',concentration:false},p);
 assert.equal(t.sheet!.spellSlots[0],1);assert.equal(t.turn!.bonusUsed,true);
 assert.throws(()=>act(s,'cast',{tokenId:t.id,spellName:'Another spell',slotLevel:1,castingTime:'action',concentration:false},p),/one spell slot/);
 act(s,'cast',{tokenId:t.id,spellName:'GM-reviewed cantrip',slotLevel:0,castingTime:'action',concentration:false},p);assert.equal(s.combat.actionUsed,true);
});
test('2014 bonus-action spell restriction includes reaction cantrips',()=>{
 const {s,t,p}=wizard('srd-5.1');act(s,'cast',{tokenId:t.id,spellName:'Bonus spell',slotLevel:1,castingTime:'bonus',concentration:false},p);
 assert.throws(()=>act(s,'cast',{tokenId:t.id,spellName:'Reaction cantrip',slotLevel:0,castingTime:'reaction',concentration:false},p),/2014 bonus-action/);
 act(s,'cast',{tokenId:t.id,spellName:'Action cantrip',slotLevel:0,castingTime:'action',concentration:false},p);
});
test('a new creature turn clears slot restriction but does not restore an already used reaction',()=>{
 const {s,t,p}=wizard('srd-5.2.1');act(s,'cast',{tokenId:t.id,spellName:'Reaction spell',slotLevel:1,castingTime:'reaction',concentration:false},p);
 act(s,'combat',{mode:'next'});assert.equal(t.turn!.slotSpent,false);assert.equal(t.turn!.reactionUsed,true);
 assert.throws(()=>act(s,'maneuver',{tokenId:t.id,mode:'reaction'},p),/already been used/);
});
test('concentration damage save differs by edition DC cap and ends on incapacitation',()=>{
 const {s,t}=wizard('srd-5.2.1');t.maxHp=300;t.hp=300;t.sheet!.concentration='Test';
 const messages:string[]=[];changeHitPoints(s,t,-100,{die:()=>1,log:(_s:GameState,_k:string,message:string)=>messages.push(message)});
 assert.equal(t.sheet!.concentration,undefined);assert.ok(messages[0].includes('DC 30'));
 t.sheet!.concentration='New';act(s,'condition',{tokenId:t.id,condition:'stunned',enabled:true});assert.equal(t.sheet!.concentration,undefined);
});
test('dash consumes the action and condition restrictions block movement',()=>{
 const {s,t,p}=wizard('srd-5.2.1');const before=s.combat.remainingMovement;act(s,'maneuver',{tokenId:t.id,mode:'dash'},p);assert.equal(s.combat.remainingMovement,before+30);assert.equal(s.combat.actionUsed,true);
 assert.throws(()=>act(s,'maneuver',{tokenId:t.id,mode:'dodge'},p),/already used/);
 act(s,'condition',{tokenId:t.id,condition:'restrained',enabled:true});assert.equal(effectiveSpeed(s,t),0);
});
test('long rest recovers different hit-dice counts and does not revive dead heroes',()=>{
 for(const edition of ['srd-5.1','srd-5.2.1'] as const){const {s,t}=wizard(edition);act(s,'combat',{mode:'end'});act(s,'character',{tokenId:t.id,level:5});t.sheet!.hitDice=0;t.sheet!.spellSlots[0]=0;t.hp=1;act(s,'rest',{mode:'long'});assert.equal(t.sheet!.hitDice,edition==='srd-5.1'?2:5);assert.equal(t.sheet!.spellSlots[0],4);assert.equal(t.hp,t.maxHp);}
 const {s,t}=wizard('srd-5.2.1');act(s,'combat',{mode:'end'});t.hp=0;t.sheet!.deathSaves.dead=true;act(s,'rest',{mode:'long'});assert.equal(t.hp,0);
});
test('death save is available to own downed hero exactly once per turn',()=>{
 const {s,t,p}=wizard('srd-5.2.1');t.hp=0;act(s,'deathSave',{tokenId:t.id},p);assert.equal(t.turn!.deathSaveRolled,true);
 // Natural 20 could recover the hero; both outcomes must reject a second roll.
 assert.throws(()=>act(s,'deathSave',{tokenId:t.id},p),/already|only to/);
});
test('healing resets death-save tally and zero HP ends concentration',()=>{
 const {s,t}=wizard('srd-5.2.1');t.hp=1;t.sheet!.concentration='Spell';changeHitPoints(s,t,-1,{die:()=>10,log:()=>{}});assert.equal(t.sheet!.concentration,undefined);assert.ok(t.sheet!.conditions.includes('unconscious'));
 t.sheet!.deathSaves.failures=2;changeHitPoints(s,t,3,{die:()=>10,log:()=>{}});assert.equal(t.sheet!.deathSaves.failures,0);assert.equal(t.sheet!.conditions.includes('unconscious'),false);
});
test('a level-five fighter gets two attacks but cannot attack after taking a different action',()=>{
 const s=createInitialState('TEST23',gm,'srd-5.2.1'),t=s.tokens[0],target=s.tokens.find(t=>t.kind==='enemy')!;
 act(s,'character',{tokenId:t.id,level:5});act(s,'combat',{mode:'start'});s.combat.order=[t.id,target.id];s.combat.turnIndex=0;t.x=8;t.y=7;target.x=9;target.y=7;target.hp=200;target.maxHp=200;
 act(s,'attack',{tokenId:t.id,targetId:target.id});act(s,'attack',{tokenId:t.id,targetId:target.id});assert.equal(t.turn!.attacksMade,2);
 assert.throws(()=>act(s,'attack',{tokenId:t.id,targetId:target.id}),/already used/);
 act(s,'combat',{mode:'next'});act(s,'combat',{mode:'next'});act(s,'maneuver',{tokenId:t.id,mode:'dash'});assert.throws(()=>act(s,'attack',{tokenId:t.id,targetId:target.id}),/already used/);
});
test('notes can be edited in combat without restoring resources',()=>{
 const {s,t,p}=wizard('srd-5.2.1');t.hp=1;t.sheet!.spellSlots[0]=0;
 act(s,'character',{tokenId:t.id,notes:'Concentrating on the conversation.'},p);
 assert.equal(t.hp,1);assert.equal(t.sheet!.spellSlots[0],0);
 assert.throws(()=>act(s,'character',{tokenId:t.id,statistics:{ac:25}},p),/Only the GM/);
});
test('GM equipment adjustments preserve current HP and cannot be forged by a player',()=>{
 const {s,t,p}=wizard('srd-5.2.1');act(s,'combat',{mode:'end'});t.hp=1;
 assert.throws(()=>act(s,'character',{tokenId:t.id,statistics:{ac:25}},p),/Only the GM/);
 act(s,'character',{tokenId:t.id,statistics:{ac:15,maxHp:40,damageModifier:4},reason:'Equipment and feat correction'});assert.equal(t.hp,1);assert.equal(t.ac,15);assert.equal(t.maxHp,40);
});
test('short rests restore pact slots while ordinary slots remain spent',()=>{
 const s=createInitialState('TEST23',gm,'srd-5.2.1'),p:Member={id:'warlock',name:'Lock',role:'player'};addPlayer(s,p,'warlock');const t=s.tokens.find(t=>t.id===p.characterId)!;
 act(s,'cast',{tokenId:t.id,spellName:'Pact spell',slotLevel:1,castingTime:'action',concentration:false,usePact:true},p);assert.equal(t.sheet!.pactSlots,0);
 act(s,'rest',{mode:'short',tokenId:t.id,hitDice:0});assert.equal(t.sheet!.pactSlots,1);
});
test('healing a conscious character does not remove an unrelated unconscious condition',()=>{
 const {s,t}=wizard('srd-5.2.1');act(s,'condition',{tokenId:t.id,condition:'unconscious',enabled:true});t.hp=1;
 changeHitPoints(s,t,1,{die:()=>10,log:()=>{}});assert.ok(t.sheet!.conditions.includes('unconscious'));
});

test('mid-turn speed changes retain spent distance and recalculate Dash in both editions',()=>{
 for(const edition of ['srd-5.1','srd-5.2.1'] as const){
  const {s,t,p}=wizard(edition);
  act(s,'move',{tokenId:t.id,x:2,y:9},p);assert.equal(s.combat.remainingMovement,25);
  act(s,'condition',{tokenId:t.id,condition:'grappled',enabled:true});
  assert.equal(s.combat.remainingMovement,0);
  assert.throws(()=>act(s,'move',{tokenId:t.id,x:2,y:8},p),/no movement speed/);
  act(s,'condition',{tokenId:t.id,condition:'grappled',enabled:false});
  assert.equal(s.combat.remainingMovement,25,'ending a grapple does not refund distance already walked');
  act(s,'maneuver',{tokenId:t.id,mode:'dash'},p);
  assert.equal(s.combat.remainingMovement,55);
  act(s,'move',{tokenId:t.id,x:2,y:7},p);assert.equal(s.combat.remainingMovement,45);
  act(s,'exhaustion',{tokenId:t.id,level:2});
  assert.equal(s.combat.remainingMovement,edition==='srd-5.1'?15:25,'Dash uses the reduced speed too');
  act(s,'exhaustion',{tokenId:t.id,level:0});assert.equal(s.combat.remainingMovement,45);
 }
});

test('falling unconscious and recovering mid-turn preserves movement already spent',()=>{
 const {s,t,p}=wizard('srd-5.2.1');act(s,'move',{tokenId:t.id,x:2,y:9},p);t.hp=1;
 act(s,'adjustHp',{tokenId:t.id,amount:-1,reason:'Damage'});assert.equal(s.combat.remainingMovement,0);
 act(s,'adjustHp',{tokenId:t.id,amount:1,reason:'Healing'});assert.equal(s.combat.remainingMovement,25);
 act(s,'move',{tokenId:t.id,x:2,y:8},p);assert.equal(s.combat.remainingMovement,20);
});

test('Dodge loses Dexterity-save advantage when movement stops or the creature is incapacitated',()=>{
 const {s,t,p}=wizard('srd-5.2.1');act(s,'maneuver',{tokenId:t.id,mode:'dodge'},p);
 let rolls=0;
 const helpers={die:()=>{rolls++;return 10;},log:()=>{},fail:(message:string):never=>{throw new Error(message);},requireGm:()=>{},requireTurn:()=>{},controlledToken:()=>t};
 const check=()=>{rolls=0;applyExpandedAction(s,p,{id:crypto.randomUUID(),type:'check',tokenId:t.id,ability:'dex',kind:'save'},helpers);return rolls;};
 assert.equal(check(),2);
 act(s,'condition',{tokenId:t.id,condition:'grappled',enabled:true});assert.equal(check(),1);
 act(s,'condition',{tokenId:t.id,condition:'grappled',enabled:false});assert.equal(check(),1,'the lost Dodge benefit does not resume after release');
 t.turn!.dodging=true;act(s,'condition',{tokenId:t.id,condition:'incapacitated',enabled:true});assert.equal(check(),1);
});

test('Dodge cannot impose attack disadvantage against an attacker the defender cannot see',()=>{
 const {s,t}=wizard('srd-5.2.1'),attacker=s.tokens[0];t.turn!.dodging=true;
 assert.equal(attackAdvantage(s,attacker,t),-1);
 t.sheet!.conditions.push('blinded');assert.equal(attackAdvantage(s,attacker,t),1);
 t.sheet!.conditions=[];attacker.sheet!.conditions.push('invisible');assert.equal(attackAdvantage(s,attacker,t),1);
});

test('downed creatures reserve their space and legacy overlaps block recovery before rolling',()=>{
 const {s,t,p}=wizard('srd-5.2.1'),other=s.tokens[0];other.hp=0;other.x=2;other.y=9;
 assert.throws(()=>act(s,'move',{tokenId:t.id,x:2,y:9},p),/blocked/);
 t.hp=0;other.x=t.x;other.y=t.y;
 assert.throws(()=>act(s,'adjustHp',{tokenId:t.id,amount:1,reason:'Healing'}),/Move the other creature/);
 assert.throws(()=>act(s,'deathSave',{tokenId:t.id},p),/Move the other creature/);
 assert.equal(t.turn!.deathSaveRolled,false);assert.equal(t.hp,0);
 t.sheet!.deathSaves.dead=true;assert.throws(()=>act(s,'revive',{tokenId:t.id,reason:'Revival spell'}),/Move the other creature/);
 other.x=3;act(s,'revive',{tokenId:t.id,reason:'Revival spell'});assert.equal(t.hp,1);
});

test('initially downed heroes enter initiative, receive death-save turns, and can rejoin after healing',()=>{
 const s=createInitialState('DYING',gm,'srd-5.2.1'),p:Member={id:'dying-player',name:'Arin',role:'player'};addPlayer(s,p,'wizard');
 const t=s.tokens.find(token=>token.id===p.characterId)!,other=s.tokens[0];s.tokens=[t,other];t.hp=0;t.sheet!.conditions.push('unconscious');
 act(s,'combat',{mode:'start'});assert.ok(s.combat.order.includes(t.id));assert.equal(s.combat.order.length,2);
 if(s.combat.order[s.combat.turnIndex]!==t.id)act(s,'combat',{mode:'next'});
 assert.equal(s.combat.remainingMovement,0);
 act(s,'deathSave',{tokenId:t.id},p);assert.equal(t.turn!.deathSaveRolled,true);
 if(t.hp===0)act(s,'adjustHp',{tokenId:t.id,amount:1,reason:'Healing spell'});
 assert.equal(s.combat.remainingMovement,30);
 act(s,'move',{tokenId:t.id,x:2,y:9},p);assert.equal(s.combat.remainingMovement,25);
});

test('an open door cannot close over a downed character',()=>{
 const s=createInitialState('DOOR',gm,'srd-5.2.1'),actor=s.tokens[0],downed=s.tokens[1],door=s.objects[0];
 door.open=true;actor.x=3;actor.y=5;downed.hp=0;downed.x=door.x;downed.y=door.y;
 assert.throws(()=>act(s,'interact',{tokenId:actor.id,objectId:door.id}),/doorway/);assert.equal(door.open,true);
});
