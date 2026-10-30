"use client";

import { useEffect, useRef, useState } from 'react';
import { Copy, Download, Link2, LockKeyhole, RefreshCw, Shield, Users } from 'lucide-react';
import { invitationLink } from '@/lib/browser-session';
import type { DeskWorld } from './hearthbound-desk';

type Credentials = { room: string; token: string };
type Identity = { id: string; name: string; role: string; characterId?: string };
type Props = {
  world: DeskWorld; me: Identity | null; creds: Credentials | null; busy: boolean;
  act: (action: Record<string, unknown>) => Promise<void>;
  onSessionResponse: (response: any) => void;
  onSessionMutation: (token: string, active: boolean) => void;
};

export default function TableSession({world, me, creds, busy, act, onSessionResponse, onSessionMutation}: Props) {
  const isGM = me?.role === 'gm';
  const [invite, setInvite] = useState('');
  const [recovery, setRecovery] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [base, setBase] = useState('');
  const version = world.session?.inviteVersion || 0;
  const issued = useRef<{invite?:string;version?:number;recovery?:string}>({});
  useEffect(() => {
    setBase(window.location.origin);
    setShowInvite(false); setShowRecovery(false); setMessage(''); setError('');
    try {
      const saved = JSON.parse(localStorage.getItem(`hearthbound-invite-${world.room}`) || 'null');
      setInvite(isGM && saved?.version === version ? saved.code : isGM && issued.current.version===version ? issued.current.invite || '' : '');
      setRecovery(issued.current.recovery || localStorage.getItem(`hearthbound-recovery-${world.room}`) || '');
    } catch { setInvite(isGM && issued.current.version===version ? issued.current.invite || '' : ''); setRecovery(issued.current.recovery || ''); }
  }, [world.room, me?.id, creds?.token, version, isGM]);
  const joinLink = base ? invitationLink(base, world.room, world.session?.inviteRequired ? invite : undefined) : '';
  const canShare = !!joinLink && (!world.session?.inviteRequired || !!invite);

  async function copy(value: string, kind: 'invite' | 'recovery') {
    setError('');
    try { if (!navigator.clipboard) throw new Error(); await navigator.clipboard.writeText(value); setMessage(kind === 'invite' ? 'Invitation copied. Send it to your players.' : 'Your private recovery code was copied.'); }
    catch { if (kind === 'invite') setShowInvite(true); else setShowRecovery(true); setMessage('Select the revealed text and copy it with Ctrl+C.'); }
  }
  async function request(type: 'invite' | 'recoveryCode') {
    if (!creds) return;
    setWorking(true); setError(''); setMessage(''); onSessionMutation(creds.token, true);
    try {
      const r = await fetch('/api/game', {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${creds.token}`}, body:JSON.stringify({type, room:creds.room})});
      const data = await r.json() as {error?:string;inviteCode?:string;recoveryCode?:string;state:DeskWorld}; if (!r.ok) throw new Error(data.error || 'The table could not be updated.');
      issued.current={...issued.current,...(data.inviteCode?{invite:data.inviteCode,version:data.state.session?.inviteVersion}:{}),...(data.recoveryCode?{recovery:data.recoveryCode}:{})};
      onSessionResponse(data);
      if (data.inviteCode) { setInvite(data.inviteCode); try { localStorage.setItem(`hearthbound-invite-${world.room}`,JSON.stringify({code:data.inviteCode,version:data.state.session?.inviteVersion})); } catch {setShowInvite(true);} }
      if (data.recoveryCode) { setRecovery(data.recoveryCode); try {localStorage.setItem(`hearthbound-recovery-${world.room}`,data.recoveryCode);} catch {setShowRecovery(true);} }
      setMessage(type === 'invite' ? 'New invitation ready. Previous invitations no longer admit new players.' : 'New private recovery code ready. Keep it somewhere safe.');
    } catch (e) { setError((e as Error).message); } finally { setWorking(false); onSessionMutation(creds.token, false); }
  }
  async function exportCampaign() {
    if (!creds) return;
    setWorking(true); setError('');
    try {
      const r = await fetch(`/api/game?room=${encodeURIComponent(creds.room)}&download=campaign`,{headers:{Authorization:`Bearer ${creds.token}`}});
      if (!r.ok) { const data = await r.json() as {error?:string}; throw new Error(data.error || 'The campaign could not be exported.'); }
      const blob = await r.blob(), url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `hearthbound-${world.room}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage('Campaign archive downloaded. It includes private GM notes.');
    } catch (e) { setError((e as Error).message); } finally { setWorking(false); }
  }
  const disabled = busy || working || !creds;
  const label = world.ruleSetId === 'srd-5.1' ? 'D&D 2014 · SRD 5.1' : world.ruleSetId === 'srd-5.2.1' ? 'D&D 2024 · SRD 5.2.1' : 'Legacy prototype';
  return <div className="table-session">
    <div className="session-summary"><div><span className="eyebrow">ONE WORLD, ONE TABLE</span><h2>Your adventuring party</h2><p>{label} · Table <b>{world.room || 'preview'}</b></p></div><span className={`session-status ${world.session?.locked ? 'closed' : ''}`}><LockKeyhole size={14}/>{world.session?.locked ? 'New joins closed' : 'Welcoming players'}</span></div>
    {error && <p role="alert" className="desk-error">{error}</p>}{message && <p role="status" className="session-message">{message}</p>}
    <div className="desk-columns">
      <section>
        {isGM ? <div className="desk-card invitation-card"><Link2 size={24}/><h3>Bring everyone into this world</h3><p>Send your players the invitation. They open the same server and join with their own name and character.</p>
          {canShare ? <><div className="recovery-code"><input aria-label="Player invitation link" readOnly type={showInvite?'text':'password'} value={joinLink}/><button className="secondary-button" onClick={()=>setShowInvite(v=>!v)}>{showInvite?'Hide':'Show'}</button></div><button className="gold-button" disabled={disabled || world.session?.locked} onClick={()=>copy(joinLink,'invite')}><Copy size={15}/>Copy player invitation</button></> : <p className="info-box">Create a fresh invitation for this browser to share.</p>}
          <div className="inline-buttons session-actions"><button className="secondary-button" disabled={disabled} onClick={()=>request('invite')}><RefreshCw size={14}/>{invite?'Replace invitation':'Create invitation'}</button><button className="secondary-button" disabled={disabled} onClick={()=>act({type:'session',op:'lock',locked:!world.session?.locked})}><LockKeyhole size={14}/>{world.session?.locked?'Open new joins':'Close new joins'}</button></div>
          <p className="desk-note">Closing joins keeps your current players connected. Replacing an invitation invalidates older invitation links.</p>
          {base.includes('127.0.0.1') || base.includes('localhost') ? <p className="info-box">Playing on separate computers? Start <b>START-LAN-GAME.cmd</b> on the host and open its home-network address before copying an invitation. Only the host needs the Windows download.</p> : <p className="desk-note">Everyone needs access to this server. An invitation does not change the hosted website's sharing permissions.</p>}
        </div> : <div className="desk-card"><Users size={24}/><h3>Your place at the table</h3><p>You share this map, its story and its rules with everyone here. The GM controls new invitations and assigns characters.</p></div>}
        <h3>At the table <span className="count">{world.members.length}/8</span></h3>
        <div className="seat-list">{world.members.map(member => {
          const hero = world.tokens.find(t=>t.ownerId===member.id);
          return <div className="seat-card" key={member.id}><div className="seat-heading"><span className="seat-avatar">{member.role==='gm'?<Shield size={18}/>:<Users size={18}/>}</span><div><strong>{member.name}{member.id===me?.id?' · You':''}</strong><small>{member.role==='gm'?'Game Master':hero?.name || 'Adventurer'}</small></div></div>
            {isGM && <><label>Assigned character<select aria-label={`Character for ${member.name}`} value={hero?.id || ''} disabled={disabled||world.combat.active} onChange={e=>{if(e.target.value)act({type:'session',op:'assign',tokenId:e.target.value,memberId:member.id});else if(hero)act({type:'session',op:'assign',tokenId:hero.id,memberId:null});}}><option value="">GM-controlled / no assigned hero</option>{world.tokens.filter(t=>t.kind==='hero').map(t=><option key={t.id} value={t.id}>{t.name}{t.ownerId&&t.ownerId!==member.id?' · reassign':''}</option>)}</select></label>{member.role!=='gm'&&<button className="quiet-danger" disabled={disabled} onClick={()=>act({type:'session',op:'remove',memberId:member.id})}>Remove player & close new joins</button>}</>}
          </div>;
        })}</div>
        {isGM&&<p className="desk-note">Character assignment is available outside combat. Removing a player keeps their character for the GM and closes new joins. Replace the invitation before reopening if they should not return.</p>}
      </section>
      <section>
        <div className="desk-card"><Shield size={24}/><h3>Keep your seat safe</h3><p>Your personal recovery code restores this same role and character in another browser. Keep it private.</p>
          {recovery&&<><div className="recovery-code"><input aria-label="Personal recovery code" readOnly type={showRecovery?'text':'password'} value={recovery}/><button className="secondary-button" onClick={()=>setShowRecovery(v=>!v)}>{showRecovery?'Hide':'Show'}</button></div><button className="secondary-button" disabled={disabled} onClick={()=>copy(recovery,'recovery')}><Copy size={14}/>Copy private recovery code</button></>}
          <button className="secondary-button session-actions" disabled={disabled} onClick={()=>request('recoveryCode')}><RefreshCw size={14}/>{recovery?'Replace recovery code':'Create recovery code'}</button><p className="desk-note">Replacing the code signs out other browsers using this seat. Your current browser stays connected.</p>
        </div>
        {isGM&&<div className="desk-card"><Download size={24}/><h3>Your campaign archive</h3><p>Download characters, maps, rules and GM notes for your records. Session keys and recovery codes are excluded.</p><button className="secondary-button" disabled={disabled} onClick={exportCampaign}><Download size={14}/>Export campaign archive</button><p className="desk-note">This is a readable JSON archive. Importing an archive is not available in this version. Keep the file private if it contains your story's secrets.</p></div>}
        <h3>How to play together</h3><ol className="session-steps"><li>One person hosts the game and creates a table.</li><li>Each player opens that host's invitation in their own browser.</li><li>The GM sets the scene and reviews character choices.</li><li>Use the map to move, attack, interact and ping. Use the Spellbook for supported spells.</li></ol>
        <p className="desk-note">Separate local installations create separate worlds. Each campaign keeps its chosen rules edition. AI is optional.</p>
      </section>
    </div>
  </div>;
}
