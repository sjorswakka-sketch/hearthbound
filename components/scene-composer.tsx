"use client";

import { useMemo } from 'react';
import { Dices, Layers3, PencilRuler, RefreshCw } from 'lucide-react';
import { SCENE_THEMES, sceneTemplate, type SceneTheme } from '@/lib/scenes';
import { DEFAULT_GENERATION_OPTIONS, generateSceneLayout, type GenerationOptions } from '@/lib/world-generator';
import './scene-composer.css';

export type SceneDraft = GenerationOptions & { name: string; narration: string; ambience: string };
export function createSceneDraft(seed: string): SceneDraft {
  return { ...DEFAULT_GENERATION_OPTIONS, seed, name: '', narration: '', ambience: '' };
}
/** Called only after mounting or from a user action; works over a home-network URL. */
export function freshSceneSeed(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export const sceneThemeLabels: Record<SceneTheme, string> = {
  harbor: 'Coast & water', crypt: 'Underground halls', forest: 'Woods & streams',
  tavern: 'Warm interiors', cavern: 'Caves & pools', ruins: 'Weathered stone',
};
type Props = {
  value: SceneDraft; onChange: (next: SceneDraft) => void; disabled?: boolean; compact?: boolean;
  showName?: boolean; showNarration?: boolean; showAtmosphere?: boolean;
};
const layouts = [
  { id: 'generated' as const, label: 'New variation', description: 'Shape a different map with your choices.', icon: Dices },
  { id: 'blank' as const, label: 'Blank canvas', description: 'Start with open ground and build by hand.', icon: PencilRuler },
  { id: 'template' as const, label: 'Authored template', description: 'Use a familiar starting map, then edit it.', icon: Layers3 },
];

export default function SceneComposer({ value, onChange, disabled = false, compact = false, showName = true, showNarration = true, showAtmosphere = true }: Props) {
  const appearance = sceneTemplate(value.theme);
  const preview = useMemo(() => {
    if (value.layout === 'generated' && !value.seed.trim()) return { map: null, error: '' };
    try { return { map: generateSceneLayout({ layout: value.layout, theme: value.theme, seed: value.seed, arrangement: value.arrangement, density: value.density, encounter: value.encounter }), error: '' }; }
    catch (error) { return { map: null, error: (error as Error).message || 'Check the map choices to see your preview.' }; }
  }, [value.layout, value.theme, value.seed, value.arrangement, value.density, value.encounter]);
  const change = <K extends keyof SceneDraft>(field: K, next: SceneDraft[K]) => onChange({ ...value, [field]: next });
  const chooseLayout = (layout: GenerationOptions['layout']) => onChange({ ...value, layout, ...(layout === 'blank' ? { encounter: 'none' as const } : {}), seed: value.seed || freshSceneSeed() });
  const map = preview.map;
  const width = map?.terrain[0]?.length || 20, height = map?.terrain.length || 14;
  return <div className={`scene-composer${compact ? ' compact' : ''}`}>
    <div className="composer-layouts" role="group" aria-label="Starting map style">
      {layouts.map(layout => <button key={layout.id} type="button" disabled={disabled} aria-label={layout.label} aria-pressed={value.layout === layout.id} className={value.layout === layout.id ? 'selected' : ''} onClick={() => chooseLayout(layout.id)}>
        <layout.icon size={18} /><span><strong>{layout.label}</strong><small>{layout.description}</small></span>
      </button>)}
    </div>
    <div className="composer-main">
      <div className="composer-choices">
        {showName && <label>New location name<input aria-label="New location name" value={value.name} maxLength={50} disabled={disabled} onChange={event => change('name', event.target.value)} placeholder="Give this place your own name" /></label>}
        <label>{value.layout === 'template' ? 'Starting template' : 'Visual setting'}<select aria-label={value.layout === 'template' ? 'Starting template' : 'Visual setting'} value={value.theme} disabled={disabled} onChange={event => change('theme', event.target.value as SceneTheme)}>
          {SCENE_THEMES.map(theme => <option key={theme} value={theme}>{value.layout === 'template' ? sceneTemplate(theme).name : sceneThemeLabels[theme]}</option>)}
        </select></label>
        {value.layout === 'generated' && <div className="composer-setting-grid">
          <label>Map shape<select aria-label="Map shape" value={value.arrangement} disabled={disabled} onChange={event => change('arrangement', event.target.value as GenerationOptions['arrangement'])}>
            <option value="wilderness">Open wilderness</option><option value="rooms">Connected chambers</option><option value="settlement">Settlement & streets</option>
          </select></label>
          <label>Terrain detail<select aria-label="Terrain detail" value={value.density} disabled={disabled} onChange={event => change('density', event.target.value as GenerationOptions['density'])}>
            <option value="sparse">Spacious</option><option value="balanced">Balanced</option><option value="dense">Dense</option>
          </select></label>
        </div>}
        {value.layout !== 'blank' && <label>Encounter starting point<select aria-label="Encounter starting point" value={value.encounter} disabled={disabled} onChange={event => change('encounter', event.target.value as GenerationOptions['encounter'])}>
          <option value="none">No creatures — decide during play</option><option value="scouts">A few scout placeholders</option><option value="guardians">Guardian placeholders</option>
        </select></label>}
        {showAtmosphere && <label>Atmosphere<input aria-label="New location atmosphere" value={value.ambience} maxLength={100} disabled={disabled} onChange={event => change('ambience', event.target.value)} placeholder="Summer rain · Distant festival drums" /></label>}
        {showNarration && <label>Your scene introduction<textarea aria-label="Your scene introduction" value={value.narration} rows={4} maxLength={2400} disabled={disabled} onChange={event => change('narration', event.target.value)} placeholder="What is happening here? What can the party see, hear or choose to investigate?" /></label>}
        {(showNarration || showAtmosphere) && <p className="desk-note composer-story-note">Your words are shared as written. Layout choices control the terrain; you decide what it means in the story.</p>}
      </div>
      <div className="composer-preview-panel">
        <div className="composer-preview-heading"><span className="eyebrow">YOUR MAP PREVIEW</span>{value.layout === 'generated' && <button className="secondary-button" type="button" disabled={disabled} onClick={() => change('seed', freshSceneSeed())}><RefreshCw size={14} />Another variation</button>}</div>
        {map ? <svg className="composer-map" viewBox={`0 0 ${width * 10} ${height * 10}`} role="img" aria-label={`Draft ${sceneThemeLabels[value.theme].toLowerCase()} map, ${width} by ${height} squares, ${map.enemies.length} creature placeholders`}>
          <rect width={width * 10} height={height * 10} fill={appearance.ground} />
          {map.terrain.flatMap((row, y) => Array.from(row).map((tile, x) => <rect key={`${x},${y}`} x={x * 10} y={y * 10} width={10} height={10} fill={tile === '~' ? appearance.water : tile === '#' ? appearance.wall : 'transparent'} stroke="#14241a" strokeOpacity=".2" strokeWidth=".5" />))}
          {map.objects.map((object, index) => object.type === 'door' ? <path key={index} d={`M${object.x * 10 + 1} ${object.y * 10 + 5}h8`} stroke={appearance.accent} strokeWidth="2" /> : <rect key={index} x={object.x * 10 + 2} y={object.y * 10 + 2} width={6} height={6} rx={1} fill={appearance.accent} />)}
          {map.enemies.map((enemy, index) => <circle key={index} cx={enemy.x * 10 + 5} cy={enemy.y * 10 + 5} r={3} fill="#f2a28d" stroke="#3c2721" strokeWidth=".5" />)}
        </svg> : <div className="composer-preview-empty">{preview.error || 'Preparing your map preview…'}</div>}
        <div className="composer-map-legend"><span>{width} × {height} squares · 5 ft each</span>{!!map?.enemies.length && <span><i /> Creature placeholders</span>}</div>
        {value.layout === 'blank' ? <p className="desk-note">Open ground, ready for your own terrain, doors, objects and creatures in the map editor.</p> : value.layout === 'template' ? <p className="desk-note">{appearance.description} Creature placement follows your encounter choice.</p> : <p className="desk-note">Each variation builds a new arrangement. Review it here, then keep editing it after the party arrives.</p>}
        {value.encounter !== 'none' && value.layout !== 'blank' && <p className="desk-note">Creature markers use editable example statistics. The GM chooses their identities and checks encounter difficulty using the campaign rules.</p>}
        {value.layout !== 'blank' && <details className="composer-repeat"><summary>Repeat this layout</summary><label>Layout seed<input aria-label="Layout seed" value={value.seed} maxLength={64} disabled={disabled} onChange={event => change('seed', event.target.value)} placeholder="Keep this code to repeat your map" spellCheck={false} autoComplete="off" /></label><p className="desk-note">The same seed and choices produce the same starting map in this version. Keep it private if the map contains surprises.</p></details>}
        {preview.error && <p className="desk-error" role="alert">{preview.error}</p>}
      </div>
    </div>
  </div>;
}
