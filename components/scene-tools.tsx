"use client";

import { useEffect, useState } from 'react';
import { Compass, MapPlus, Save } from 'lucide-react';
import { SCENE_THEMES, type SceneInfo, type SceneTheme } from '@/lib/scenes';
import type { GenerationOptions } from '@/lib/world-generator';
import SceneComposer, { createSceneDraft, freshSceneSeed, sceneThemeLabels, type SceneDraft } from './scene-composer';
import './scene-tools.css';

type SceneWorld = { title: string; narrative?: string; combat: { active: boolean }; world?: { activeScene: string; currentScene?: SceneInfo & { generation?: GenerationOptions }; scenes: { id: string; name: string }[] } };
type Props = { world: SceneWorld; busy: boolean; act: (action: Record<string, unknown>) => Promise<void> };

export default function SceneTools({ world, busy, act }: Props) {
  const current = world.world?.currentScene;
  const [name, setName] = useState(current?.name ?? world.title);
  const [theme, setTheme] = useState<SceneTheme>(current?.theme ?? 'harbor');
  const [ambience, setAmbience] = useState(current?.ambience ?? '');
  const [narration, setNarration] = useState(current?.narration ?? world.narrative ?? '');
  const [draft, setDraft] = useState<SceneDraft>(() => createSceneDraft(''));
  useEffect(() => { setDraft(createSceneDraft(freshSceneSeed())); }, [world.world?.activeScene]);
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
        <label>Visual theme<select value={theme} onChange={event => setTheme(event.target.value as SceneTheme)}>{SCENE_THEMES.map(option => <option key={option} value={option}>{sceneThemeLabels[option]}</option>)}</select></label>
        <label>Atmosphere<input value={ambience} maxLength={100} onChange={event => setAmbience(event.target.value)} placeholder="Midnight · Wind and rain" /></label>
      </div>
      <label>Scene introduction<textarea value={narration} rows={5} maxLength={2400} onChange={event => setNarration(event.target.value)} placeholder="What can everyone see, hear and feel here?" /></label>
      <button className="secondary-button" disabled={busy || !name.trim()} onClick={() => act({ type: 'world', op: 'sceneUpdate', name: name.trim(), theme, ambience, narration })}><Save size={15} /> Save this location</button>
      <p className="desk-note">Changing the visual theme preserves the existing map. The introduction is shared with the entire table.</p>
      {current?.generation && <details className="scene-starting-choices"><summary>Original map choices</summary><p className="desk-note">{sceneThemeLabels[current.generation.theme]} · {current.generation.layout} · {current.generation.arrangement} · {current.generation.density}</p>{current.generation.seed && <label>Original layout seed<input readOnly value={current.generation.seed} /></label>}<button className="secondary-button" type="button" disabled={locked} onClick={() => setDraft({ ...createSceneDraft(freshSceneSeed()), ...current.generation!, name: '', narration: '', ambience: '' })}>Use these choices for a new draft</button><p className="desk-note">This copies the original starting choices into the draft below. Hand-painted edits remain in the current location.</p></details>}
    </section>
    <section className="desk-card">
      <div className="eyebrow"><MapPlus size={14} /> BUILD THE NEXT CHAPTER</div>
      <h3>Make somewhere only your party knows.</h3>
      <p className="desk-note">Set your own premise, try different map arrangements, or start with a blank canvas. Everything below is a draft until you create the location.</p>
      <SceneComposer value={draft} onChange={setDraft} disabled={locked} />
      <button className="gold-button" disabled={locked || !draft.name.trim() || (draft.layout === 'generated' && !draft.seed.trim()) || (world.world?.scenes.length ?? 0) >= 12} onClick={() => act({ type: 'world', op: 'sceneCreate', name: draft.name.trim(), preset: draft.theme, layout: draft.layout, seed: draft.seed, arrangement: draft.arrangement, density: draft.density, encounter: draft.encounter, narration: draft.narration, ambience: draft.ambience })}><MapPlus size={16} /> Create and travel here</button>
      <p className="desk-note">The party travels together and keeps the campaign's chosen ruleset. Up to 12 locations per campaign.</p>
      {world.combat.active && <p className="info-box">Finish the encounter before creating or visiting another location.</p>}
    </section>
  </div>;
}
