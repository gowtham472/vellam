import type { WaterDepth } from '../core/types.ts';

/**
 * Asks Cloudflare's clef-flash what a resident's photo shows. clef is a decision model: it
 * is given typed questions and returns a probability for each allowed answer, not prose, so
 * its output can be held to a threshold like any other measurement.
 *
 * This is the one call in Vellam that leaves AWS, and the one place a model is used. It
 * judges a photo. It does not set a flood level; the rules in `core` do that with the
 * verdict as one more piece of evidence.
 */

export interface ClefConfig {
  readonly accountId: string;
  readonly token: string;
}

export interface Photo {
  readonly contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  readonly base64: string;
}

export interface PhotoJudgement {
  /** Probability that the photo shows flood water, from 0 to 1. */
  readonly waterProbability: number;
  /** The depth the model thinks most likely. */
  readonly depth: WaterDepth;
}

const MODEL = 'clef-flash';
const TIMEOUT_MS = 12_000;

const QUESTIONS = {
  water: {
    type: 'noul',
    instructions: 'Does this photo show flood water or rain water standing on a street, in a yard, or inside a building?',
    criteria: {
      true: 'Standing or flowing water covers ground that is normally dry',
      false: 'No such water is visible, or the image is not a photograph of a real place',
    },
  },
  depth: {
    type: 'choice',
    instructions: 'How deep is the water on the ground in this photo, judged against people, vehicles, doors and walls?',
    criteria: {
      NONE: 'No standing water, or only wet ground and small puddles',
      ANKLE: 'Up to the ankle: shoes are covered, tyres are wet at the bottom',
      KNEE: 'Up to the knee: about half the height of a car wheel or more',
      WAIST: 'Up to the waist or deeper: car bonnets or door handles are reached',
    },
  },
} as const;

const DEPTHS: readonly WaterDepth[] = ['NONE', 'ANKLE', 'KNEE', 'WAIST'];

/**
 * Reads the two answers. Cloudflare's REST API wraps a model's output in `result`, while the
 * model's own schema describes the output unwrapped, so both shapes are accepted.
 */
export function parsePhotoJudgement(body: unknown): PhotoJudgement {
  const outer = body as { result?: unknown; answers?: unknown };
  const answers = ((outer.result as { answers?: unknown } | undefined)?.answers ?? outer.answers) as
    | { water?: { noul?: unknown }; depth?: { choice?: unknown } }
    | undefined;
  const waterProbability = answers?.water?.noul;
  const depth = answers?.depth?.choice;
  if (typeof waterProbability !== 'number' || waterProbability < 0 || waterProbability > 1 || typeof depth !== 'string' || !DEPTHS.includes(depth as WaterDepth)) {
    throw new Error('The photo check returned an answer in an unexpected shape');
  }
  return { waterProbability, depth: depth as WaterDepth };
}

export async function fetchPhotoJudgement(config: ClefConfig, photo: Photo): Promise<PhotoJudgement> {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/@cf/cloudflare/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      state: 'A resident sent this photo to report the water at their street.',
      questions: QUESTIONS,
      images: [{ content_type: photo.contentType, base64: photo.base64 }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // The status is enough to act on. The body can echo account details, so it is not logged or passed on.
  if (!response.ok) throw new Error(`The photo check failed (${String(response.status)})`);
  return parsePhotoJudgement(await response.json());
}
