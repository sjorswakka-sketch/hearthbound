export type RuleSetId = 'prototype' | 'srd-5.1' | 'srd-5.2.1';
export const RULESETS = [
  {id:'srd-5.1', label:'D&D 2014 · SRD 5.1', source:'/rules/srd-5.1.pdf'},
  {id:'srd-5.2.1', label:'D&D 2024 · SRD 5.2.1', source:'/rules/srd-5.2.1.pdf'},
] as const;
export const ABILITIES = ['str','dex','con','int','wis','cha'] as const;
export type Ability = typeof ABILITIES[number];
export type Abilities = Record<Ability,number>;
export const SKILLS: Record<string,Ability> = {acrobatics:'dex',animalHandling:'wis',arcana:'int',athletics:'str',deception:'cha',history:'int',insight:'wis',intimidation:'cha',investigation:'int',medicine:'wis',nature:'int',perception:'wis',performance:'cha',persuasion:'cha',religion:'int',sleightOfHand:'dex',stealth:'dex',survival:'wis'};
export const CONDITIONS = ['blinded','charmed','deafened','frightened','grappled','incapacitated','invisible','paralyzed','petrified','poisoned','prone','restrained','stunned','unconscious'] as const;
export const CHARACTER_CLASSES = ['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard'] as const;
export type CharacterClass = typeof CHARACTER_CLASSES[number];
export type Profile = {hitDie:number; saves:Ability[]; priority:Ability[]; skills:string[]; casting?:Ability; progression?:'full'|'half'|'pact'; armor:'chain'|'chain-shirt-shield'|'leather'|'none'|'barbarian'|'monk'; weapon:string; weaponAbility:Ability; damageDie:number; range:number; color:string};
export const CLASS_PROFILES: Record<CharacterClass,Profile> = {
 barbarian:{hitDie:12,saves:['str','con'],priority:['str','con','dex','wis','cha','int'],skills:['athletics','survival'],armor:'barbarian',weapon:'Battleaxe',weaponAbility:'str',damageDie:8,range:1,color:'#c18461'},
 bard:{hitDie:8,saves:['dex','cha'],priority:['cha','dex','con','wis','int','str'],skills:['performance','persuasion','insight'],casting:'cha',progression:'full',armor:'leather',weapon:'Dagger',weaponAbility:'dex',damageDie:4,range:1,color:'#c89bbe'},
 cleric:{hitDie:8,saves:['wis','cha'],priority:['wis','con','str','cha','dex','int'],skills:['medicine','religion'],casting:'wis',progression:'full',armor:'chain-shirt-shield',weapon:'Mace',weaponAbility:'str',damageDie:6,range:1,color:'#8dc8be'},
 druid:{hitDie:8,saves:['int','wis'],priority:['wis','con','dex','int','cha','str'],skills:['nature','survival'],casting:'wis',progression:'full',armor:'leather',weapon:'Quarterstaff',weaponAbility:'str',damageDie:6,range:1,color:'#8eb780'},
 fighter:{hitDie:10,saves:['str','con'],priority:['str','con','dex','wis','cha','int'],skills:['athletics','perception'],armor:'chain',weapon:'Longsword',weaponAbility:'str',damageDie:8,range:1,color:'#daa85c'},
 monk:{hitDie:8,saves:['str','dex'],priority:['dex','wis','con','str','cha','int'],skills:['acrobatics','stealth'],armor:'monk',weapon:'Quarterstaff',weaponAbility:'dex',damageDie:6,range:1,color:'#d9a768'},
 paladin:{hitDie:10,saves:['wis','cha'],priority:['str','cha','con','wis','dex','int'],skills:['athletics','persuasion'],casting:'cha',progression:'half',armor:'chain',weapon:'Longsword',weaponAbility:'str',damageDie:8,range:1,color:'#cfbd82'},
 ranger:{hitDie:10,saves:['str','dex'],priority:['dex','wis','con','str','int','cha'],skills:['perception','stealth','survival'],casting:'wis',progression:'half',armor:'leather',weapon:'Longbow',weaponAbility:'dex',damageDie:8,range:30,color:'#95b58b'},
 rogue:{hitDie:8,saves:['dex','int'],priority:['dex','int','con','wis','cha','str'],skills:['acrobatics','stealth','sleightOfHand','investigation'],armor:'leather',weapon:'Shortbow',weaponAbility:'dex',damageDie:6,range:16,color:'#ad93df'},
 sorcerer:{hitDie:6,saves:['con','cha'],priority:['cha','con','dex','wis','int','str'],skills:['arcana','persuasion'],casting:'cha',progression:'full',armor:'none',weapon:'Dagger',weaponAbility:'dex',damageDie:4,range:1,color:'#cf8e9a'},
 warlock:{hitDie:8,saves:['wis','cha'],priority:['cha','con','dex','wis','int','str'],skills:['arcana','deception'],casting:'cha',progression:'pact',armor:'leather',weapon:'Dagger',weaponAbility:'dex',damageDie:4,range:1,color:'#b09bc7'},
 wizard:{hitDie:6,saves:['int','wis'],priority:['int','con','dex','wis','cha','str'],skills:['arcana','history'],casting:'int',progression:'full',armor:'none',weapon:'Dagger',weaponAbility:'dex',damageDie:4,range:1,color:'#75b6dc'},
};
// SRD class tables, slots indexed by spell level minus one. Multiclassing and
// subclass-specific resources require GM adjudication; this is a single-class sheet.
const FULL_SLOTS = [
 [2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],
 [4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],
 [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
];
export function modifier(score:number){return Math.floor((score-10)/2);}
export function proficiency(level:number){return 2+Math.floor((level-1)/4);}
export function standardAbilities(characterClass:string):Abilities {
 const p=CLASS_PROFILES[characterClass as CharacterClass]??CLASS_PROFILES.fighter;
 const scores=[15,14,13,12,10,8];return Object.fromEntries(p.priority.map((a,i)=>[a,scores[i]])) as Abilities;
}
export function slotTable(characterClass:string,level:number,ruleSetId:RuleSetId):number[]{
 const progression=CLASS_PROFILES[characterClass as CharacterClass]?.progression;
 let casterLevel=progression==='full'?level:progression==='half'?(ruleSetId==='srd-5.2.1'?Math.ceil(level/2):Math.floor(level/2)):0;
 if(!casterLevel)return Array(9).fill(0);
 return Array.from({length:9},(_,i)=>FULL_SLOTS[casterLevel-1]?.[i]??0);
}
export type CharacterSheet={
 level:number;abilities:Abilities;proficiency:number;skills:string[];saveProficiencies:Ability[];
 inventory:{name:string;quantity:number}[];spellSlots:number[];maxSpellSlots:number[];
 pactSlotLevel:number;pactSlots:number;maxPactSlots:number;hitDice:number;hitDie:number;
 conditions:string[];exhaustion:number;deathSaves:{successes:number;failures:number;stable:boolean;dead:boolean};
 concentration?:string;notes:string;weapon:string;damageModifier:number;spellAbility?:Ability;spellSaveDC?:number;spellAttack?:number;
};
export type TurnResources={bonusUsed:boolean;reactionUsed:boolean;slotSpent:boolean;bonusSpellCast:boolean;nonCantripCast:boolean;otherSpellCast:boolean;dodging:boolean;disengaged:boolean;helping:boolean;ready:boolean;deathSaveRolled:boolean;attacksMade:number;movementSpent?:number;dashes?:number};
export function newTurn():TurnResources{return {bonusUsed:false,reactionUsed:false,slotSpent:false,bonusSpellCast:false,nonCantripCast:false,otherSpellCast:false,dodging:false,disengaged:false,helping:false,ready:false,deathSaveRolled:false,attacksMade:0,movementSpent:0,dashes:0};}
export function makeSheet(characterClass:string,ruleSetId:RuleSetId,level=1,abilities=standardAbilities(characterClass)):CharacterSheet {
 const profile=CLASS_PROFILES[characterClass as CharacterClass]??CLASS_PROFILES.fighter;
 const slots=slotTable(characterClass,level,ruleSetId), pact=profile.progression==='pact', pactSlotLevel=pact?Math.min(5,Math.ceil(level/2)):0,maxPactSlots=pact?(level===1?1:level<11?2:level<17?3:4):0;
 return {level,abilities:{...abilities},proficiency:proficiency(level),skills:[...profile.skills],saveProficiencies:[...profile.saves],inventory:[{name:profile.weapon,quantity:1},{name:'Adventuring supplies (GM determines contents)',quantity:1}],spellSlots:[...slots],maxSpellSlots:slots,pactSlotLevel,pactSlots:maxPactSlots,maxPactSlots,hitDice:level,hitDie:profile.hitDie,conditions:[],exhaustion:0,deathSaves:{successes:0,failures:0,stable:false,dead:false},notes:'Single-class starting profile. Apply origin bonuses, features, proficiencies and equipment with the GM using the selected SRD.',weapon:profile.weapon,damageModifier:modifier(abilities[profile.weaponAbility]),...(profile.casting?{spellAbility:profile.casting,spellSaveDC:8+proficiency(level)+modifier(abilities[profile.casting]),spellAttack:proficiency(level)+modifier(abilities[profile.casting])}:{})};
}
export function derivedStats(characterClass:string,sheet:CharacterSheet){
 const p=CLASS_PROFILES[characterClass as CharacterClass]??CLASS_PROFILES.fighter,dex=modifier(sheet.abilities.dex),con=modifier(sheet.abilities.con);
 const maxHp=Math.max(sheet.level,p.hitDie+con+(sheet.level-1)*(p.hitDie/2+1+con));
 const ac=p.armor==='chain'?16:p.armor==='chain-shirt-shield'?15+Math.min(2,dex):p.armor==='leather'?11+dex:p.armor==='barbarian'?10+dex+con:p.armor==='monk'?10+dex+modifier(sheet.abilities.wis):10+dex;
 // Starting loadouts are intentionally conservative. Higher-level class and
 // origin choices remain in the reference/GM workflow rather than being guessed.
 return {maxHp,hp:maxHp,ac,speed:30,attackBonus:sheet.proficiency+modifier(sheet.abilities[p.weaponAbility]),damageDie:p.damageDie,range:p.range,color:p.color};
}
export function attacksPerAction(characterClass:string,level:number){
 if(characterClass==='fighter')return level>=20?4:level>=11?3:level>=5?2:1;
 return ['barbarian','monk','paladin','ranger'].includes(characterClass)&&level>=5?2:1;
}
