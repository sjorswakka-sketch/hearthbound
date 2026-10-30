import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Native Node tests.
import {createInitialState,addPlayer,applyAction} from '../lib/game.ts';
// @ts-ignore Native Node tests.
import {SPELLS,spellAreaCells,spellAffectedCells} from '../lib/spells.ts';
import type {Action,GameState,Member} from '../lib/game';
const gm:Member={id:'gm',name:'GM',role:'gm'};
const act=(s:GameState,type:string,fields:Record<string,unknown>={},m=gm)=>applyAction(s,m,{id:crypto.randomUUID(),type,...fields} as Action);
function table(edition:'srd-5.1'|'srd-5.2.1'='srd-5.2.1',characterClass='wizard'){
 const s=createInitialState('SPELLS',gm,edition),p:Member={id:'player',name:'Arin',role:'player'};addPlayer(s,p,characterClass);
 const actor=s.tokens.find(t=>t.id===p.characterId)!,enemy=s.tokens.find(t=>t.kind==='enemy')!,ally=s.tokens.find(t=>t.kind==='hero'&&t.id!==actor.id)!;
 s.tokens=[actor,enemy,ally];s.terrain=Array(s.height).fill('.'.repeat(s.width));s.objects=[];
 Object.assign(actor,{x:2,y:2});Object.assign(enemy,{x:3,y:2,hp:200,maxHp:200});Object.assign(ally,{x:2,y:3,hp:1,maxHp:100});
 act(s,'character',{tokenId:actor.id,level:5});act(s,'spellPrepare',{tokenId:actor.id,spellIds:SPELLS.map(spell=>spell.id),ability:characterClass==='cleric'?'wis':'int'});
 s.combat={active:true,round:1,order:[actor.id,enemy.id,ally.id],turnIndex:0,remainingMovement:30,actionUsed:false};
 const cast=(spellId:string,fields:Record<string,unknown>={},m=p)=>act(s,'spell',{tokenId:actor.id,spellId,slotLevel:1,targetIds:[enemy.id],confirmed:true,...fields},m);
 return {s,p,actor,enemy,ally,cast};
}
function rejectsUnchanged(s:GameState,fn:()=>void,pattern:RegExp){const before=structuredClone(s);assert.throws(fn,pattern);assert.deepEqual(s,before);}

test('GM preparation is required, cannot be forged, and cannot refill resources',()=>{
 const {s,p,actor,cast}=table();actor.sheet!.preparedSpellIds=[];
 rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0}),/GM must approve/);
 s.combat.active=false;actor.sheet!.spellSlots[0]=1;
 rejectsUnchanged(s,()=>act(s,'spellPrepare',{tokenId:actor.id,spellIds:['fire-bolt'],ability:'int'},p),/Only the GM/);
 act(s,'spellPrepare',{tokenId:actor.id,spellIds:['fire-bolt'],ability:'int'});assert.equal(actor.sheet!.spellSlots[0],1);
 rejectsUnchanged(s,()=>act(s,'spellPrepare',{tokenId:actor.id,spellIds:['wish'],ability:'int'}),/supported spells/);
 s.combat.active=true;rejectsUnchanged(s,()=>act(s,'spellPrepare',{tokenId:actor.id,spellIds:[],ability:'int'}),/outside an encounter/);
});

test('Cure Wounds and Healing Word use edition-specific healing and upcasting',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=0;return a;});
 for(const edition of ['srd-5.1','srd-5.2.1'] as const)for(const spellId of ['cure-wounds','healing-word']){
  const {s,actor,ally,cast}=table(edition,'cleric'),modifier=Math.floor((actor.sheet!.abilities.wis-10)/2);
  cast(spellId,{slotLevel:2,targetIds:[ally.id]});
  assert.equal(ally.hp,1+2*(edition==='srd-5.1'?1:2)+modifier);
  assert.equal(actor.sheet!.spellSlots[1],2);assert.equal(actor.turn!.bonusUsed,spellId==='healing-word');assert.equal(s.combat.actionUsed,spellId==='cure-wounds');
 }
});

test('healing a downed creature resets death saves and unconsciousness without reviving the dead',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=0;return a;});
 const {s,ally,cast}=table('srd-5.2.1','cleric');ally.hp=0;ally.sheet!.conditions=['unconscious'];ally.sheet!.deathSaves.failures=2;
 cast('healing-word',{targetIds:[ally.id]});assert.ok(ally.hp>0);assert.equal(ally.sheet!.deathSaves.failures,0);assert.deepEqual(ally.sheet!.conditions,[]);
 s.combat.actionUsed=false;ally.sheet!.deathSaves.dead=true;rejectsUnchanged(s,()=>cast('cure-wounds',{targetIds:[ally.id]}),/living creatures/);
});

test('2014 Inflict Wounds attacks AC while 2024 makes a Constitution save',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=0;return a;});
 const old=table('srd-5.1','cleric');old.cast('inflict-wounds');assert.equal(old.enemy.hp,200);assert.match(old.s.log.at(-1)!.text,/Miss/);
 const modern=table('srd-5.2.1','cleric');modern.cast('inflict-wounds');assert.equal(modern.enemy.hp,198);assert.match(modern.s.log.at(-1)!.text,/CON save/);
});

test('2024 Inflict Wounds halves a successful save, and Sacred Flame deals none',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=19;return a;});
 const a=table('srd-5.2.1','cleric');a.cast('inflict-wounds',{slotLevel:2});assert.equal(a.enemy.hp,185);
 const b=table('srd-5.2.1','cleric');b.cast('sacred-flame',{slotLevel:0});assert.equal(b.enemy.hp,200);
});

test('Fire Bolt scales with character level and doubles the dice on a critical hit',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=19;return a;});
 const {actor,enemy,cast}=table();enemy.x=5;cast('fire-bolt',{slotLevel:0});assert.equal(actor.sheet!.level,5);assert.equal(enemy.hp,160);assert.equal(actor.sheet!.spellSlots[0],4);
});

test('Magic Missile requires all dart assignments, splits targets, and spends resources once on retries',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=0;return a;});
 const {s,p,actor,enemy,ally,cast}=table();s.rules.friendlyFire=true;ally.hp=100;
 rejectsUnchanged(s,()=>cast('magic-missile',{targetIds:[enemy.id]}),/exactly 3/);
 const action={id:crypto.randomUUID(),type:'spell',tokenId:actor.id,spellId:'magic-missile',slotLevel:1,targetIds:[enemy.id,ally.id,enemy.id],confirmed:true};
 applyAction(s,p,action);applyAction(s,p,action);assert.equal(enemy.hp,196);assert.equal(ally.hp,98);assert.equal(actor.sheet!.spellSlots[0],3);assert.equal(s.log.filter(l=>l.text.includes('casts Magic Missile')).length,1);
});

test('spell damage uses the shared concentration and dying-creature handling',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=0;return a;});
 const {enemy,cast,s}=table();enemy.sheet!.concentration='Test effect';cast('sacred-flame',{slotLevel:0});assert.equal(enemy.sheet!.concentration,undefined);assert.ok(s.log.some(l=>/concentration save/.test(l.text)));
 const down=table();down.enemy.hp=0;down.enemy.sheet!.conditions=['unconscious'];down.cast('magic-missile',{targetIds:[down.enemy.id,down.enemy.id,down.enemy.id]});assert.equal(down.enemy.sheet!.deathSaves.failures,3);assert.equal(down.enemy.sheet!.deathSaves.dead,true);
});

test('invalid targets, hidden targets, blocked sight and range never spend or alter state',()=>{
 const {s,actor,enemy,cast}=table();
 rejectsUnchanged(s,()=>cast('cure-wounds',{targetIds:['forged-id']}),/living creatures/);
 rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0,confirmed:false}),/Confirm/);
 rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:1}),/level 0/);
 rejectsUnchanged(s,()=>cast('cure-wounds',{targetIds:[enemy.id],slotLevel:1.1}),/valid spell slot/);
 enemy.x=5;rejectsUnchanged(s,()=>cast('inflict-wounds'),/outside/);
 s.terrain[2]='....#...............';rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0}),/wall or closed door/);s.terrain[2]='.'.repeat(20);
 s.objects=[{id:'closed',type:'door',x:4,y:2,open:false}];rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0}),/wall or closed door/);s.objects=[];
 Object.assign(s,{world:{fogEnabled:true,revealed:[`${actor.x},${actor.y}`]}});rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0}),/reveal/);
});

test('automation enforces owner, active turn, combat, available action and slots on the server',()=>{
 const {s,actor,cast}=table();const other:Member={id:'intruder',name:'Other',role:'player'};
 rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0},other),/own character/);
 s.combat.turnIndex=1;rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0}),/turn/);s.combat.turnIndex=0;
 s.combat.actionUsed=true;rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0}),/already used/);s.combat.actionUsed=false;
 actor.sheet!.spellSlots[0]=0;rejectsUnchanged(s,()=>cast('inflict-wounds'),/No spell slot/);
 s.combat.active=false;rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0}),/start an encounter/);
});

test('automated bonus spells and generic casting share both editions casting restrictions',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=0;return a;});
 for(const edition of ['srd-5.1','srd-5.2.1'] as const){const {s,actor,ally,cast}=table(edition,'cleric');cast('healing-word',{targetIds:[ally.id]});rejectsUnchanged(s,()=>cast('inflict-wounds'),edition==='srd-5.1'?/bonus-action spell rule/:/one spell slot/);cast('sacred-flame',{slotLevel:0});assert.equal(actor.sheet!.spellSlots[0],3);}
});

test('Fireball derives every target from its area and blocks allies before spending',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=0;return a;});
 const {s,actor,enemy,ally,cast}=table();Object.assign(enemy,{x:10,y:7});Object.assign(ally,{x:11,y:7,hp:100});
 rejectsUnchanged(s,()=>cast('fireball',{slotLevel:3,origin:{x:10,y:7},targetIds:[enemy.id]}),/harm an ally/);
 s.rules.friendlyFire=true;cast('fireball',{slotLevel:3,origin:{x:10,y:7},targetIds:[]});assert.equal(enemy.hp,192);assert.equal(ally.hp,92);assert.equal(actor.sheet!.spellSlots[2],1);
});

test('Fireball unknown area cells are rejected even when centre and target are revealed',()=>{
 const {s,actor,enemy,cast}=table();Object.assign(enemy,{x:10,y:7});
 Object.assign(s,{world:{fogEnabled:true,revealed:Array.from({length:s.height},(_,y)=>Array.from({length:s.width},(_,x)=>`${x},${y}`)).flat().filter(key=>key!=='10,6')}});
 rejectsUnchanged(s,()=>cast('fireball',{slotLevel:3,origin:{x:10,y:7}}),/reveal/);assert.equal(actor.sheet!.spellSlots[2],2);
});

test('2014 Fireball spreads around a corner; 2024 resolves clear lines from the origin',()=>{
 for(const edition of ['srd-5.1','srd-5.2.1'] as const){const {s,actor}=table(edition);s.terrain[7]='...........#........';const cells=spellAffectedCells(s,actor,'fireball',{x:10,y:7});assert.equal(cells.some((p:{x:number;y:number})=>p.x===12&&p.y===7),edition==='srd-5.1');assert.equal(cells.some((p:{x:number;y:number})=>p.x===11&&p.y===7),false);}
});

test('Burning Hands uses a bounded directional cone and excludes the caster',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=0;return a;});
 const {s,actor,enemy,ally,cast}=table();const cells=spellAreaCells(s,actor,'burning-hands',undefined,'e');assert.ok(cells.some((p:{x:number;y:number})=>p.x===enemy.x&&p.y===enemy.y));assert.ok(!cells.some((p:{x:number;y:number})=>p.x===actor.x&&p.y===actor.y));assert.ok(!cells.some((p:{x:number;y:number})=>p.x===ally.x&&p.y===ally.y));
 rejectsUnchanged(s,()=>cast('burning-hands',{direction:'invalid'}),/direction/);cast('burning-hands',{direction:'e'});assert.equal(enemy.hp,197);assert.equal(ally.hp,1);
});

test('unsupported known condition exceptions and forged cone directions require a manual ruling',()=>{
 const {s,actor,enemy,cast}=table();rejectsUnchanged(s,()=>cast('burning-hands',{direction:'__proto__'}),/direction/);
 actor.sheet!.conditions=['charmed'];rejectsUnchanged(s,()=>cast('sacred-flame',{slotLevel:0}),/Charmed/);
 actor.sheet!.conditions=['frightened'];rejectsUnchanged(s,()=>cast('fire-bolt',{slotLevel:0}),/Frightened/);
 actor.sheet!.conditions=[];enemy.sheet!.conditions=['petrified'];rejectsUnchanged(s,()=>cast('sacred-flame',{slotLevel:0}),/Petrified/);
});

test('an active player can end only their own turn and must resolve a required death save',t=>{
 t.mock.method(crypto,'getRandomValues',(a:Uint32Array)=>{a[0]=9;return a;});
 const {s,p,actor,enemy}=table();rejectsUnchanged(s,()=>act(s,'endTurn',{tokenId:enemy.id},p),/own character/);
 s.combat.turnIndex=1;rejectsUnchanged(s,()=>act(s,'endTurn',{tokenId:actor.id},p),/turn/);s.combat.turnIndex=0;
 actor.hp=0;rejectsUnchanged(s,()=>act(s,'endTurn',{tokenId:actor.id},p),/death saving throw/);act(s,'deathSave',{tokenId:actor.id},p);act(s,'endTurn',{tokenId:actor.id},p);assert.equal(s.combat.order[s.combat.turnIndex],enemy.id);
 s.combat.active=false;rejectsUnchanged(s,()=>act(s,'endTurn',{tokenId:actor.id},p),/not started/);
});

test('arrivals search legal floor and avoid downed creatures and closed objects',()=>{
 const s=createInitialState('SPAWNS',gm,'srd-5.2.1');s.width=5;s.height=3;s.terrain=['#####','#...#','#####'];s.tokens=s.tokens.slice(0,1);Object.assign(s.tokens[0],{x:1,y:1,hp:0});s.objects=[{id:'door',type:'door',x:2,y:1,open:false}];
 const p:Member={id:'new',name:'New hero',role:'player'};addPlayer(s,p,'wizard');const token=s.tokens.find(t=>t.id===p.characterId)!;assert.deepEqual([token.x,token.y],[3,1]);
 const q:Member={id:'second',name:'Second hero',role:'player'},before=structuredClone(s);assert.throws(()=>addPlayer(s,q,'fighter'),/no safe arrival/);assert.deepEqual(s,before);assert.equal(q.characterId,undefined);
});
