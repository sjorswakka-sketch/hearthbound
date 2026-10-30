import { GameError } from '@/lib/game';
import { parseGenerationOptions, type GenerationOptions } from '@/lib/world-generator';

export type CampaignStart = GenerationOptions & {
  name: string;
  premise: string;
  ambience: string;
  companions: boolean;
};

function field(value: unknown, fallback: string, max: number, label: string, required = false) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new GameError(`${label} must be ${required ? 'non-empty text' : 'text'} of at most ${max} characters.`);
  }
  return value.trim();
}

/** Story text is shared as written; no model interprets it or changes the rules. */
export function parseCampaignStart(value: unknown): CampaignStart {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GameError('Choose valid campaign settings.');
  const input = value as Record<string, unknown>;
  const allowed = ['name', 'premise', 'ambience', 'companions', 'theme', 'layout', 'seed', 'arrangement', 'density', 'encounter'];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new GameError('Unknown campaign setting.');
  if (input.companions !== undefined && typeof input.companions !== 'boolean') throw new GameError('Choose whether to include sample companions.');
  let generation: GenerationOptions;
  try {
    generation = parseGenerationOptions({
      layout: input.layout ?? 'generated', theme: input.theme ?? 'forest',
      seed: input.seed ?? crypto.randomUUID(), arrangement: input.arrangement ?? 'wilderness',
      density: input.density ?? 'balanced', encounter: input.encounter ?? 'none',
    });
  } catch (error) { throw new GameError(error instanceof Error ? error.message : 'Choose valid map settings.'); }
  return {
    ...generation,
    name: field(input.name, 'Untitled adventure', 50, 'Campaign name', true),
    premise: field(input.premise, '', 2400, 'Campaign premise'),
    ambience: field(input.ambience, '', 100, 'Atmosphere'),
    companions: input.companions === true,
  };
}
