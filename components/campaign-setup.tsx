"use client";
import {useEffect,useRef} from 'react';
import {Compass,Flame,X} from 'lucide-react';
import SceneComposer,{type SceneDraft} from './scene-composer';
import './campaign-setup.css';

type Props={open:boolean;onClose:()=>void;draft:SceneDraft;onChange:(draft:SceneDraft)=>void;companions:boolean;setCompanions:(value:boolean)=>void;ruleSetId:string;setRuleSetId:(value:string)=>void;gm:string;busy:boolean;error:string;onSubmit:(event:React.FormEvent)=>void};

export default function CampaignSetup({open,onClose,draft,onChange,companions,setCompanions,ruleSetId,setRuleSetId,gm,busy,error,onSubmit}:Props){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open&&!dialog.current?.open)dialog.current?.showModal();else if(!open&&dialog.current?.open)dialog.current.close()},[open]);
 return <dialog ref={dialog} className="campaign-setup" aria-labelledby="campaign-setup-title" onCancel={e=>{if(busy)e.preventDefault();else onClose()}} onClick={e=>{if(e.target===dialog.current&&!busy)onClose()}}>
  <header className="campaign-setup-heading"><div><span className="eyebrow"><Flame size={14}/> YOUR STORY STARTS HERE</span><h2 id="campaign-setup-title">What world will you share?</h2></div><button type="button" className="icon-button" disabled={busy} onClick={onClose} aria-label="Close world setup"><X size={22}/></button></header>
  <form onSubmit={onSubmit} className="campaign-setup-form"><div className="campaign-setup-scroll">
   <p className="campaign-lead">You choose the place, the people and the opening moment. Everyone joins the same world, and you can keep changing it as the story unfolds.</p>
   {error&&<p role="alert" className="desk-error">{error}</p>}
   <div className="campaign-story-fields"><section><label>Campaign name<input disabled={busy} required autoComplete="off" value={draft.name} maxLength={50} onChange={e=>onChange({...draft,name:e.target.value})} placeholder="Give this adventure its own name"/></label><label>Your opening premise<textarea disabled={busy} rows={5} maxLength={2400} value={draft.narration} onChange={e=>onChange({...draft,narration:e.target.value})} placeholder="Where are the characters? What is happening, and what can they do next?"/></label><p className="desk-note">Your words become the shared opening. You control the map below; the story text is not interpreted by AI.</p></section><aside><label>Campaign rules<select disabled={busy} value={ruleSetId} onChange={e=>setRuleSetId(e.target.value)}><option value="srd-5.2.1">D&D 2024 · SRD 5.2.1</option><option value="srd-5.1">D&D 2014 · SRD 5.1</option></select></label><p>The rules edition stays with the campaign. Changing the scenery does not change its mechanics.</p><label className="checkbox-label"><input disabled={busy} type="checkbox" checked={companions} onChange={e=>setCompanions(e.target.checked)}/>Add two sample heroes for GM practice</label><p className="desk-note">Leave this off for players to join with their own characters.</p><span className="campaign-gm">Game Master · {gm}</span></aside></div>
   <SceneComposer value={draft} onChange={onChange} disabled={busy} showName={false} showNarration={false} showAtmosphere={true}/>
  </div><footer className="campaign-setup-footer"><span>Your invitation is ready after creation.</span><button type="submit" className="gold-button" disabled={busy||!draft.name.trim()||(draft.layout==='generated'&&!draft.seed.trim())}><Compass size={16}/>{busy?'Opening your world…':'Create this world'}</button></footer></form>
 </dialog>;
}
