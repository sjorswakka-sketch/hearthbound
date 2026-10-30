"use client";

import { useEffect, useState } from 'react';
import { Compass, MapPlus, Save } from 'lucide-react';
import { SCENE_TEMPLATES, sceneLayout, sceneTemplate, type SceneInfo, type SceneTheme } from '@/lib/scenes';
import './scene-tools.css';

type SceneWorld = { title: string; narrative?: string; combat: { active: boolean }; world?: { activeScene: string; currentScene?: SceneInfo; scenes: { id: string; name: string }[] } };
type Props = { world: SceneWorld; busy: boolean; act: (action: Record<string, unknown>) => Promise<void> };
const previews = SCENE_TEMPLATES.map(template => ({ template, layout: sceneLayout(template.id) }));

export default function SceneTools({ world, busy, act }: Props) {
  const current = world.world?.currentScene;
  const [name, setName] = useState(current?.name ?? world.title);
  const [theme, setTheme] = useState<SceneTheme>(current?.theme ?? 'harbor');
  const [ambience, setAmbience] = useState(current?.ambience ?? '');
  const [narration, setNarration] = useState(current?.narration ?? world.narrative ?? '');
  const [preset, setPreset] = useState<SceneTheme>('tavern');
  const [newName, setNewName] = useState(sceneTemplate('tavern').name);
  useEffect(() => {
    setName(current?.name ?? world.title); setTheme(current?.theme ?? 'harbor');
    setAmbience(current?.ambience ?? ''); setNarration(current?.narration ?? world.narrative ?? '');
  }, [current?.id, current?.name, current?.theme, current?.ambience, current?.narration, world.title, world.narrative]);
  const locked = busy || world.combat.active;
  return <div className="scene-tools">
    <section className="desk-card scene-metadata">
      <div className="eyebrow"><Compass size={14} /> THE CURRENT LOCATION</div>
      <h3>Give this place a voice.</h3>
      <p className="desk-note">Each location remembers its own introduction, atmosphere, map and creatures.</p>
      <label>Scene name<input value={name} maxLength={50} onChange={event => setName(event.target.value)} /></label>
      <div className="form-grid">
        <label>Visual theme<select value={theme} onChange={event => setTheme(event.target.value as SceneTheme)}>{SCENE_TEMPLATES.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
        <label>Atmosphere<input value={ambience} maxLength={100} onChange={event => setAmbience(event.target.value)} placeholder="Midnight · Wind and rain" /></label>
      </div>
      <label>Scene introduction<textarea value={narration} rows={5} maxLength={2400} onChange={event => setNarration(event.target.value)} placeholder="What can everyone see, hear and feel here?" /></label>
      <button className="secondary-button" disabled={busy || !name.trim()} onClick={() => act({ type: 'world', op: 'sceneUpdate', name: name.trim(), theme, ambience, narration })}><Save size={15} /> Save this location</button>
      <p className="desk-note">Changing the visual theme preserves the existing map. The introduction is shared with the entire table.</p>
    </section>
    <section className="desk-card">
      <div className="eyebrow"><MapPlus size={14} /> BUILD THE NEXT CHAPTER</div>
      <h3>Choose a place to explore.</h3>
      <div className="scene-template-grid">
        {previews.map(({ template, layout }) => <button type="button" className={'scene-template-choice ' + (preset === template.id ? 'selected' : '')} aria-pressed={preset === template.id} key={template.id} disabled={locked} onClick={() => { setPreset(template.id); setNewName(template.name); }}>
          <svg viewBox="0 0 200 140" aria-hidden="true">
            <rect width="200" height="140" fill={template.ground} />
            {layout.terrain.flatMap((row, y) => Array.from(row).map((tile, x) => tile === '.' ? null : <rect key={x + ',' + y} x={x * 10} y={y * 10} width={10} height={10} fill={tile === '~' ? template.water : template.wall} />))}
            {layout.objects.map((object, index) => <rect key={index} x={object.x * 10 + 2} y={object.y * 10 + 2} width={6} height={6} rx={1} fill={template.accent} />)}
            {layout.enemies.map((enemy, index) => <circle key={index} cx={enemy.x * 10 + 5} cy={enemy.y * 10 + 5} r={3} fill="#ed9c8a" />)}
          </svg>
          <strong>{template.name}</strong><small>{template.subtitle}</small>
        </button>)}
      </div>
      <p className="scene-template-description">{sceneTemplate(preset).description}</p>
      <label>New location name<input value={newName} onChange={event => setNewName(event.target.value)} maxLength={50} /></label>
      <button className="gold-button" disabled={locked || !newName.trim() || (world.world?.scenes.length ?? 0) >= 12} onClick={() => act({ type: 'world', op: 'sceneCreate', name: newName.trim(), preset })}><MapPlus size={16} /> Create and travel here</button>
      <p className="desk-note">The party travels together. Templates include editable example encounters; the GM decides what creatures represent and how they behave. Up to 12 locations per campaign.</p>
      {world.combat.active && <p className="info-box">Finish the encounter before creating or visiting another location.</p>}
    </section>
  </div>;
}
