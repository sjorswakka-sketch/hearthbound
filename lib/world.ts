import {GameError, applyAction, publicState, type GameState, type Member, type Token, type GameObject, type Action} from '@/lib/game';

type Scene = {id:string;name:string;terrain:string[];objects:GameObject[];enemies:Token[];revealed:string[]};
export type WorldData = {fogEnabled:boolean;revealed:string[];gmNotes:string;activeScene:string;scenes:Scene[]};
type WorldState = GameState & {world?:WorldData};
const key=(x:number,y:number)=>`${x},${y}`;
export function worldData(state:GameState):WorldData {
 const s=state as WorldState;
 return s.world??=( {fogEnabled:false,revealed:[],gmNotes:'',activeScene:'harbor',scenes:[{id:'harbor',name:'The Lantern Harbor',terrain:[],objects:[],enemies:[],revealed:[]}]} );
}
function log(s:GameState,text:string){s.log.push({id:crypto.randomUUID(),kind:'world',text,at:new Date().toISOString()});s.log=s.log.slice(-100);}
function number(v:unknown,min:number,max:number){if(typeof v!=='number'||!Number.isInteger(v)||v<min||v>max)throw new GameError('Choose a valid map value.');return v;}
function text(v:unknown,max:number){if(typeof v!=='string'||!v.trim()||v.length>max)throw new GameError(`Enter text under ${max} characters.`);return v.trim();}
// Downed characters still need a safe space when healed or moved between scenes.
function occupied(s:GameState,x:number,y:number){return s.tokens.some(t=>t.x===x&&t.y===y);}
function clear(s:GameState,x:number,y:number){return s.terrain[y]?.[x]==='.'&&!occupied(s,x,y)&&!s.objects.some(o=>o.x===x&&o.y===y&&(o.type==='chest'||!o.open));}
function saveScene(s:GameState,w:WorldData){const current=w.scenes.find(c=>c.id===w.activeScene);if(current)Object.assign(current,{terrain:[...s.terrain],objects:structuredClone(s.objects),enemies:structuredClone(s.tokens.filter(t=>t.kind==='enemy')),revealed:[...w.revealed]});}
function switchScene(s:GameState,w:WorldData,scene:Scene){
 const heroes=s.tokens.filter(t=>t.kind==='hero');
 const trial={...s,terrain:[...scene.terrain],objects:structuredClone(scene.objects),tokens:structuredClone(scene.enemies)};
 for(const hero of heroes){let placed=false;for(let y=1;y<s.height-1&&!placed;y++)for(let x=1;x<s.width-1&&!placed;x++){if(clear(trial,x,y)){trial.tokens.push({...hero,x,y});placed=true;}}if(!placed)throw new GameError('That scene has insufficient room for the party.');}
 saveScene(s,w);s.terrain=trial.terrain;s.objects=trial.objects;s.tokens=trial.tokens;w.activeScene=scene.id;w.revealed=[...scene.revealed];s.title=scene.name;
}
export function applyWorldAction(s:GameState,m:Member,a:Action){
 if(m.role!=='gm')throw new GameError('Only the GM can edit the world.',403);
 if(typeof a.id!=='string'||a.id.length<8||a.id.length>100)throw new GameError('A valid action ID is required.');
 if(s.processed?.some(p=>p.id===a.id&&p.memberId===m.id))return;
 const w=worldData(s);
 if(a.op==='notes'){if(typeof a.text!=='string'||a.text.length>10000)throw new GameError('Keep private notes under 10,000 characters.');w.gmNotes=a.text;}
 else if(a.op==='fog'){if(typeof a.enabled!=='boolean')throw new GameError('Choose fog on or off.');w.fogEnabled=a.enabled;log(s,`The GM ${a.enabled?'enabled':'disabled'} shared fog of war.`);}
 else if(a.op==='reveal'){
  const x=number(a.x,0,s.width-1),y=number(a.y,0,s.height-1);if(typeof a.revealed!=='boolean')throw new GameError('Choose reveal or hide.');const cells=new Set(w.revealed);if(a.revealed)cells.add(key(x,y));else cells.delete(key(x,y));w.revealed=[...cells];
 }else{
  if(s.combat.active)throw new GameError('End the encounter before editing terrain or changing scenes.');
  if(a.op==='sceneCreate'){
   if(w.scenes.length>=12)throw new GameError('This campaign supports up to 12 scenes.');
   if(!['harbor','crypt','forest'].includes(String(a.preset)))throw new GameError('Choose a scene template.');
   const terrain=Array.from({length:s.height},(_,y)=>Array.from({length:s.width},(_,x)=>x===0||y===0||x===s.width-1||y===s.height-1?'#':a.preset==='forest'&&(x*7+y*3)%17===0?'#':a.preset==='harbor'&&x>13&&y>3&&y<9?'~':a.preset==='crypt'&&x===10&&y>2&&y<11&&y!==7?'#':'.').join(''));
   const scene:Scene={id:crypto.randomUUID(),name:text(a.name,50),terrain,objects:[],enemies:[],revealed:[]};switchScene(s,w,scene);w.scenes.push(scene);log(s,`The party enters ${scene.name}.`);
  }else if(a.op==='sceneSwitch'){
   const scene=w.scenes.find(c=>c.id===a.sceneId);if(!scene)throw new GameError('Scene not found.');if(scene.id!==w.activeScene){switchScene(s,w,scene);log(s,`The party returns to ${scene.name}.`);}
  }else{
   const x=number(a.x,0,s.width-1),y=number(a.y,0,s.height-1);
   if(a.op==='terrain'){
    if(!['.','#','~'].includes(String(a.tile)))throw new GameError('Choose floor, wall, or water.');
    if(a.tile!=='.'&&(occupied(s,x,y)||s.objects.some(o=>o.x===x&&o.y===y)))throw new GameError('Move the character or remove the object before blocking this tile.');
    s.terrain[y]=s.terrain[y].slice(0,x)+a.tile+s.terrain[y].slice(x+1);
   }else if(a.op==='object'){
    if(!['door','chest','remove'].includes(String(a.kind)))throw new GameError('Choose a door, chest, or remove.');
    if(a.kind!=='remove'&&(s.terrain[y][x]!=='.'||occupied(s,x,y)))throw new GameError('Choose an unoccupied floor tile.');
    s.objects=s.objects.filter(o=>o.x!==x||o.y!==y);if(a.kind!=='remove')s.objects.push({id:crypto.randomUUID(),type:a.kind as 'door'|'chest',x,y,open:false});
   }else if(a.op==='spawn'){
    if(!clear(s,x,y))throw new GameError('Choose an empty floor tile.');if(s.tokens.length>=40)throw new GameError('This scene supports up to 40 creatures.');
    const hp=number(a.hp??7,1,999),ac=number(a.ac??13,1,30);
    s.tokens.push({id:crypto.randomUUID(),name:text(a.name??'Creature',40),kind:'enemy',characterClass:'goblin',hp,maxHp:hp,ac,speed:30,x,y,color:'#e47f73',attackBonus:4,damageDie:6,range:1});
   }else throw new GameError('Unknown world edit.');
  }
 }
 s.processed=[...(s.processed??[]),{id:a.id,memberId:m.id}].slice(-160);
}

export function visibleState(s:GameState,m:Member):GameState {
 const w=worldData(s),out=publicState(s) as WorldState;
 // Whitelist identity fields. Account bindings and recovery hashes never leave the server.
 out.members=out.members.map(p=>({id:p.id,name:p.name,role:p.role,...(p.characterId?{characterId:p.characterId}:{})}));
 out.world={fogEnabled:w.fogEnabled,revealed:[...w.revealed],gmNotes:m.role==='gm'?w.gmNotes:'',activeScene:w.activeScene,scenes:w.scenes.map(c=>({id:c.id,name:c.name,terrain:[],objects:[],enemies:[],revealed:[]}))};
 if(m.role==='gm'||!w.fogEnabled)return out;
 const own=s.tokens.filter(t=>t.ownerId===m.id),known=new Set([...w.revealed,...own.map(t=>key(t.x,t.y))]);
 out.terrain=s.terrain.map((row,y)=>Array.from(row).map((c,x)=>known.has(key(x,y))?c:'?').join(''));
 out.tokens=out.tokens.filter(t=>known.has(key(t.x,t.y)));
 out.objects=out.objects.filter(o=>known.has(key(o.x,o.y)));
 // Engine logs may mention concealed creatures. Only intentionally shared speech,
 // rolls, narration and public world announcements are sent while fog is enabled.
 out.log=out.log.filter(l=>['chat','dice','world'].includes(l.kind)||(l.kind==='story'&&l.text.startsWith('GM:')));
 out.world.scenes=out.world.scenes.filter(c=>c.id===w.activeScene);
 if(out.combat.active){const current=out.combat.order[out.combat.turnIndex],order=out.combat.order.filter(id=>out.tokens.some(t=>t.id===id));const index=order.indexOf(current);out.combat={...out.combat,order,turnIndex:index,...(index<0?{remainingMovement:0,actionUsed:false}:{})};}
 return out;
}

export function guardVisibility(s:GameState,m:Member,a:Action){
 if(m.role==='gm'||!worldData(s).fogEnabled)return;
 const view=visibleState(s,m);
 if(a.type==='move'&&(typeof a.x!=='number'||typeof a.y!=='number'||!Number.isInteger(a.x)||!Number.isInteger(a.y)||!view.terrain[a.y]?.[a.x]||view.terrain[a.y][a.x]==='?'))throw new GameError('Ask the GM to reveal this area before moving there.');
 if(a.targetId&&!view.tokens.some(t=>t.id===a.targetId))throw new GameError('That target is not visible.');
 if(a.objectId&&!view.objects.some(o=>o.id===a.objectId))throw new GameError('That object is not visible.');
 if(a.type==='attack'){
  const actor=view.tokens.find(t=>t.id===a.tokenId&&t.ownerId===m.id),target=view.tokens.find(t=>t.id===a.targetId);
  if(actor&&target){
   // Match the engine's sight sampling, without consulting concealed terrain.
   // A distant revealed target must not become a way to probe hidden walls.
   const dx=target.x-actor.x,dy=target.y-actor.y,steps=Math.max(Math.abs(dx),Math.abs(dy))*4;
   for(let n=1;n<steps;n++)if(view.terrain[Math.round(actor.y+dy*n/steps)]?.[Math.round(actor.x+dx*n/steps)]==='?')throw new GameError('Ask the GM to reveal the line of sight before attacking.');
  }
 }
}

export function applyVisibleAction(s:GameState,m:Member,a:Action){
 if(s.processed?.some(p=>p.id===a.id&&p.memberId===m.id))return;
 guardVisibility(s,m,a);
 if(m.role==='gm'||!worldData(s).fogEnabled||a.type!=='move'){applyAction(s,m,a);return;}
 // Resolve pathfinding and its movement cost against revealed cells only.
 // Checking the destination alone permits hidden shortcuts and reveals hidden
 // obstacles through success/error messages. The engine is synchronous, so the
 // original map is restored before any snapshot or persistent save can run.
 const terrain=s.terrain;
 s.terrain=visibleState(s,m).terrain;
 try{applyAction(s,m,a);}finally{s.terrain=terrain;}
}
