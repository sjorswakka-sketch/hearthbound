import type {Action, GameState, Member, Token} from './game';
import type {Ability} from './characters';

export type SpellId = 'cure-wounds'|'healing-word'|'fire-bolt'|'sacred-flame'|'magic-missile'|'inflict-wounds'|'burning-hands'|'fireball';
export type SpellDefinition = {id:SpellId;name:string;level:number;range:number;casting:'action'|'bonus';kind:'healing'|'attack'|'save'|'missiles'|'area';damage:string;pages:Record<'srd-5.1'|'srd-5.2.1',number>;classes:string[];summary:string};
export const SPELLS:SpellDefinition[] = [
 {id:'cure-wounds',name:'Cure Wounds',level:1,range:5,casting:'action',kind:'healing',damage:'healing',pages:{'srd-5.1':132,'srd-5.2.1':121},classes:['bard','cleric','druid','paladin','ranger'],summary:'Touch one creature. Healing is 1d8 per slot level in 2014, or 2d8 per slot level in 2024, plus your casting modifier.'},
 {id:'healing-word',name:'Healing Word',level:1,range:60,casting:'bonus',kind:'healing',damage:'healing',pages:{'srd-5.1':153,'srd-5.2.1':139},classes:['bard','cleric','druid'],summary:'Heal one creature you can see. Healing is 1d4 per slot level in 2014, or 2d4 per slot level in 2024, plus your casting modifier.'},
 {id:'fire-bolt',name:'Fire Bolt',level:0,range:120,casting:'action',kind:'attack',damage:'fire',pages:{'srd-5.1':144,'srd-5.2.1':132},classes:['sorcerer','wizard'],summary:'Ranged spell attack for 1d10 fire damage, scaling at character levels 5, 11 and 17. This tracker targets creatures; igniting objects is a GM ruling.'},
 {id:'sacred-flame',name:'Sacred Flame',level:0,range:60,casting:'action',kind:'save',damage:'radiant',pages:{'srd-5.1':176,'srd-5.2.1':159},classes:['cleric'],summary:'A visible creature makes a Dexterity save; failure deals 1d8 radiant damage, scaling at levels 5, 11 and 17. Half and three-quarters cover do not improve this save.'},
 {id:'magic-missile',name:'Magic Missile',level:1,range:120,casting:'action',kind:'missiles',damage:'force',pages:{'srd-5.1':161,'srd-5.2.1':146},classes:['sorcerer','wizard'],summary:'Assign each dart to a visible creature. Three darts at level 1, plus one per higher slot; each deals 1d4+1 force damage. One damage roll is shared by the simultaneous darts.'},
 {id:'inflict-wounds',name:'Inflict Wounds',level:1,range:5,casting:'action',kind:'attack',damage:'necrotic',pages:{'srd-5.1':157,'srd-5.2.1':143},classes:['cleric'],summary:'2014: melee spell attack, 3d10 necrotic. 2024: Constitution save, 2d10 necrotic, half on success. Each higher slot adds 1d10.'},
 {id:'burning-hands',name:'Burning Hands',level:1,range:15,casting:'action',kind:'area',damage:'fire',pages:{'srd-5.1':123,'srd-5.2.1':114},classes:['sorcerer','wizard'],summary:'15-foot cone. Each affected creature makes a Dexterity save against 3d6 fire damage, half on success. Each higher slot adds 1d6. Object fires remain GM-adjudicated.'},
 {id:'fireball',name:'Fireball',level:3,range:150,casting:'action',kind:'area',damage:'fire',pages:{'srd-5.1':144,'srd-5.2.1':131},classes:['sorcerer','wizard'],summary:'20-foot-radius sphere, projected onto the map. Dexterity save against 8d6 fire damage, half on success; each higher slot adds 1d6. The 2014 area spreads around corners. Object fires remain GM-adjudicated.'},
];
export function spellDefinition(id:unknown){return SPELLS.find(s=>s.id===id);}
export type SpellMap={width:number;height:number;terrain:string[];objects:{type:string;x:number;y:number;open:boolean}[]};
export type Point={x:number;y:number};
export const SPELL_DIRECTIONS:Record<string,Point>={n:{x:0,y:-1},ne:{x:1,y:-1},e:{x:1,y:0},se:{x:1,y:1},s:{x:0,y:1},sw:{x:-1,y:1},w:{x:-1,y:0},nw:{x:-1,y:-1}};
/** Tile-centre templates on a 5-ft grid; the same cells are previewed and resolved. */
export function spellAreaCells(state:SpellMap,actor:Point,id:SpellId,origin?:Point,direction?:string):Point[]{
 if(id!=='fireball'&&id!=='burning-hands')return [];
 const centre=id==='fireball'?origin:actor,dir=Object.hasOwn(SPELL_DIRECTIONS,direction??'')?SPELL_DIRECTIONS[direction!]:undefined;
 if(!centre||!Number.isInteger(centre.x)||!Number.isInteger(centre.y)||(id==='burning-hands'&&!dir))return [];
 const cells:Point[]=[];
 for(let y=0;y<state.height;y++)for(let x=0;x<state.width;x++){
  const dx=x-centre.x,dy=y-centre.y;
  if(id==='fireball'){if(dx*dx+dy*dy<=16)cells.push({x,y});}
  else if(dir){const magnitude=Math.hypot(dir.x,dir.y),along=(dx*dir.x+dy*dir.y)/magnitude,across=Math.abs(dx*dir.y-dy*dir.x)/magnitude;if(along>0&&along<=3+1e-8&&across<=along/2+1e-8)cells.push({x,y});}
 }
 return cells;
}
export function spellLineCells(from:Point,to:Point):Point[]{
 const dx=to.x-from.x,dy=to.y-from.y,steps=Math.max(Math.abs(dx),Math.abs(dy))*4,cells:Point[]=[];
 for(let n=1;n<steps;n++){const p={x:Math.round(from.x+dx*n/steps),y:Math.round(from.y+dy*n/steps)};if(!cells.some(c=>c.x===p.x&&c.y===p.y))cells.push(p);}
 return cells;
}
function obstructed(s:SpellMap,p:Point){return !s.terrain[p.y]?.[p.x]||['#','?'].includes(s.terrain[p.y][p.x])||s.objects.some(o=>o.type==='door'&&!o.open&&o.x===p.x&&o.y===p.y);}
export function spellClearLine(s:SpellMap,from:Point,to:Point){return !obstructed(s,to)&&spellLineCells(from,to).every(p=>!obstructed(s,p));}
function affectedCells(s:GameState,actor:Token,id:SpellId,origin?:Point,direction?:string){
 const cells=spellAreaCells(s,actor,id,origin,direction),centre=id==='fireball'?origin!:actor;
 if(id!=='fireball'||s.ruleSetId!=='srd-5.1')return cells.filter(p=>spellClearLine(s,centre,p));
 // 2014 Fireball explicitly spreads around corners, but never through a sealed wall.
 const allowed=new Set(cells.filter(p=>!obstructed(s,p)).map(p=>`${p.x},${p.y}`)),seen=new Set<string>(),queue=[centre];
 if(!allowed.has(`${centre.x},${centre.y}`))return [];
 for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key))continue;seen.add(key);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+dx,y:p.y+dy},k=`${q.x},${q.y}`;if(allowed.has(k)&&!seen.has(k))queue.push(q);}}
 return cells.filter(p=>seen.has(`${p.x},${p.y}`));
}
export function spellAffectedCells(s:SpellMap&{ruleSetId?:string},actor:Point,id:SpellId,origin?:Point,direction?:string){return affectedCells(s as GameState,actor as Token,id,origin,direction);}
export type SpellRuntime={
 die:(sides:number)=>number;log:(s:GameState,kind:string,message:string)=>void;fail:(message:string,status?:number)=>never;
 controlledToken:(s:GameState,m:Member,id:unknown)=>Token;spend:(s:GameState,m:Member,action:Action)=>void;
 hitPoints:(s:GameState,t:Token,amount:number,critical?:boolean)=>void;
 saveModifier:(s:GameState,t:Token,ability:Ability)=>number;attackMode:(s:GameState,a:Token,t:Token,ranged?:boolean)=>number;
 incapacitated:(t:Token)=>boolean;speed:(s:GameState,t:Token)=>number;rollD20:(mode:number)=>number;
};
function slotValue(value:unknown,h:SpellRuntime){if(typeof value!=='number'||!Number.isInteger(value)||value<0||value>9)h.fail('Choose a valid spell slot.');return value as number;}
function fogKnown(s:GameState,m:Member){const w=(s as GameState&{world?:{fogEnabled:boolean;revealed:string[]}}).world;return m.role!=='gm'&&w?.fogEnabled?new Set([...w.revealed,...s.tokens.filter(t=>t.ownerId===m.id).map(t=>`${t.x},${t.y}`)]):null;}
function checkKnown(known:Set<string>|null,cells:Point[],h:SpellRuntime){if(known&&cells.some(p=>!known.has(`${p.x},${p.y}`)))h.fail('Ask the GM to reveal the entire spell area and line of sight before using automation.');}
export function applyAutomatedSpell(s:GameState,m:Member,a:Action,h:SpellRuntime){
 const spell=spellDefinition(a.spellId);if(!spell)h.fail('Choose a supported automated spell.');
 if(!['srd-5.1','srd-5.2.1'].includes(s.ruleSetId??''))h.fail('Automated spells require a campaign using SRD 5.1 or SRD 5.2.1.');
 const actor=h.controlledToken(s,m,a.tokenId),sheet=actor.sheet!,slot=slotValue(a.slotLevel,h),modern=s.ruleSetId==='srd-5.2.1';
 if(!sheet.preparedSpellIds?.includes(spell!.id))h.fail('The GM must approve this spell on the character’s spell list first.',403);
 if(!sheet.spellAbility||sheet.spellSaveDC===undefined||sheet.spellAttack===undefined)h.fail('The GM must set a spellcasting ability first.');
 if(a.confirmed!==true)h.fail('Confirm components, eligibility and special target traits with the GM before resolving this spell.');
 if((spell!.level===0&&slot!==0)||(spell!.level>0&&slot<spell!.level))h.fail('Choose a slot at least as high as the spell, or level 0 for a cantrip.');
 if(spell!.kind!=='healing'&&!s.combat.active)h.fail('The GM must start an encounter before a damaging spell.');
 const known=fogKnown(s,m),point=a.origin as Point|undefined;
 let targets:Token[]=[];
 if(spell!.kind==='area'){
  if(spell!.id==='fireball'){
   if(!point||!Number.isInteger(point.x)||!Number.isInteger(point.y)||point.x<0||point.y<0||point.x>=s.width||point.y>=s.height)h.fail('Choose a point on this map.');
   if(Math.max(Math.abs(point!.x-actor.x),Math.abs(point!.y-actor.y))*5>spell!.range)h.fail('The spell’s point is out of range.');
   checkKnown(known,[point!,...spellLineCells(actor,point!)],h);if(!spellClearLine(s,actor,point!))h.fail('A wall or closed door blocks the spell’s point.');
  }else if(typeof a.direction!=='string'||!Object.hasOwn(SPELL_DIRECTIONS,a.direction))h.fail('Choose the direction of the cone.');
  const template=spellAreaCells(s,actor,spell!.id,point,String(a.direction??''));checkKnown(known,template,h);
  const cells=new Set(affectedCells(s,actor,spell!.id,point,String(a.direction??'')).map(p=>`${p.x},${p.y}`));
  targets=s.tokens.filter(t=>!t.sheet!.deathSaves.dead&&cells.has(`${t.x},${t.y}`));
 }else{
  if(!Array.isArray(a.targetIds)||a.targetIds.some(id=>typeof id!=='string'))h.fail('Choose the spell’s targets.');
  const ids=a.targetIds as string[],count=spell!.id==='magic-missile'?slot+2:1;if(ids.length!==count)h.fail(`Choose exactly ${count} target${count===1?'':' assignments'}.`);
  for(const id of ids){
   const t=s.tokens.find(t=>t.id===id);if(!t||t.sheet!.deathSaves.dead)h.fail('Choose living creatures on this map.');
   checkKnown(known,[t!,...spellLineCells(actor,t!)],h);
   if(Math.max(Math.abs(t!.x-actor.x),Math.abs(t!.y-actor.y))*5>spell!.range)h.fail('A selected creature is outside the spell’s range.');
   if(!spellClearLine(s,actor,t!))h.fail('A wall or closed door blocks a selected creature.');
   if(spell!.id!=='cure-wounds'&&(sheet.conditions.includes('blinded')||t!.sheet!.conditions.includes('invisible')))h.fail('This spell tracker needs a visible target. Ask the GM to resolve special senses or unseen targets.');
   if(spell!.kind==='healing'&&t!.hp===0&&s.tokens.some(other=>other.id!==t!.id&&other.x===t!.x&&other.y===t!.y))h.fail('Move the overlapping creature before healing this target.');
   targets.push(t!);
  }
 }
 if(spell!.kind!=='healing'&&!s.rules.friendlyFire&&targets.some(t=>t.kind===actor.kind))h.fail('This spell would harm an ally. Friendly fire is disabled by the GM.');
 if(spell!.kind!=='healing'&&sheet.conditions.includes('charmed'))h.fail('Resolve this harmful spell manually with the GM: the source of your Charmed condition is not tracked.');
 if((spell!.id==='fire-bolt'||(spell!.id==='inflict-wounds'&&!modern))&&sheet.conditions.includes('frightened'))h.fail('Resolve this spell attack manually with the GM: the source of your Frightened condition is not tracked.');
 if(spell!.kind!=='healing'&&targets.some(t=>t.sheet!.conditions.includes('petrified')))h.fail('Resolve this spell manually with the GM: a Petrified target has damage resistance.');
 // All geometry/target validation happens before the shared casting resource rules.
 h.spend(s,m,{...a,type:'cast',spellName:spell!.name,castingTime:spell!.casting,concentration:false});
 h.log(s,'spell',`${actor.name} casts ${spell!.name} (${slot?`level ${slot} slot`:'cantrip'}; ${s.ruleSetId}).`);
 const dice=(count:number,sides:number)=>Array.from({length:count},()=>h.die(sides)).reduce((a,b)=>a+b,0),scale=sheet.level>=17?4:sheet.level>=11?3:sheet.level>=5?2:1;
 const castingModifier=Math.floor((sheet.abilities[sheet.spellAbility!]-10)/2);
 if(spell!.kind==='healing'){
  const amount=Math.max(0,dice(slot*(modern?2:1),spell!.id==='cure-wounds'?8:4)+castingModifier),t=targets[0],before=t.hp;h.hitPoints(s,t,amount);h.log(s,'spell',`${t.name} recovers ${t.hp-before} HP (${amount} rolled).`);return;
 }
 if(spell!.id==='magic-missile'){
  const damage=h.die(4)+1;for(const t of targets){h.hitPoints(s,t,-damage);h.log(s,'spell',`A magic dart hits ${t.name} for ${damage} force damage.`);}return;
 }
 const spellAttack=spell!.id==='fire-bolt'||(spell!.id==='inflict-wounds'&&!modern);
 if(spellAttack){
  const t=targets[0],mode=h.attackMode(s,actor,t,spell!.id==='fire-bolt');
  const roll=h.rollD20(mode),bonus=sheet.spellAttack!-(modern?2*sheet.exhaustion:0),hit=roll!==1&&(roll===20||roll+bonus>=t.ac),critical=hit&&(roll===20||(Math.max(Math.abs(t.x-actor.x),Math.abs(t.y-actor.y))<=1&&t.sheet!.conditions.some(c=>['paralyzed','unconscious'].includes(c))));
  const count=spell!.id==='fire-bolt'?scale:slot+2,damage=hit?dice(count*(critical?2:1),10):0;if(damage)h.hitPoints(s,t,-damage,critical);
  h.log(s,'spell',`${actor.name} → ${t.name}: d20 ${roll} ${bonus>=0?'+':'−'} ${Math.abs(bonus)} = ${roll+bonus} vs AC ${t.ac}. ${hit?`${critical?'Critical! ':''}${damage} ${spell!.damage} damage.`:'Miss.'}`);return;
 }
 const ability:Ability=spell!.id==='inflict-wounds'?'con':'dex',count=spell!.id==='sacred-flame'?scale:spell!.id==='inflict-wounds'?slot+1:spell!.id==='fireball'?slot+5:slot+2,sides=spell!.id==='sacred-flame'?8:spell!.id==='inflict-wounds'?10:6,damage=dice(count,sides);
 for(const t of targets){
  const ts=t.sheet!,automatic=['str','dex'].includes(ability)&&ts.conditions.some(c=>['paralyzed','petrified','stunned','unconscious'].includes(c));
  const adv=ability==='dex'&&!!t.turn!.dodging&&!h.incapacitated(t)&&h.speed(s,t)>0,dis=(!modern&&ts.exhaustion>=3)||(ability==='dex'&&ts.conditions.includes('restrained'));
  const roll=automatic?0:h.rollD20(adv===dis?0:adv?1:-1),total=roll+h.saveModifier(s,t,ability),saved=!automatic&&total>=sheet.spellSaveDC!,amount=saved?(spell!.id==='sacred-flame'?0:Math.floor(damage/2)):damage;
  if(amount)h.hitPoints(s,t,-amount);h.log(s,'spell',`${t.name}: ${ability.toUpperCase()} save ${automatic?'automatically fails':`${total} vs DC ${sheet.spellSaveDC} — ${saved?'success':'failure'}`}; ${amount} ${spell!.damage} damage.`);
 }
 if(!targets.length)h.log(s,'spell','The resolved spell template contains no creatures.');
}
