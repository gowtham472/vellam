import type { Factor } from './types.ts';

/** One reservoir on one morning, as Chennai Metro Water publishes it. */
export interface ReservoirReading {
  readonly name: string;
  readonly capacityMcft: number;
  readonly storageMcft: number;
  readonly storagePercent: number;
  /** Cubic feet per second. Null where the bulletin leaves the cell blank. */
  readonly inflowCusecs: number | null;
  readonly outflowCusecs: number | null;
}

export interface ReservoirReport {
  /** The date the readings are for, `YYYY-MM-DD`. */
  readonly asOn: string;
  readonly readings: readonly ReservoirReading[];
}

export const RESERVOIR_SOURCE = 'https://cmwssb.tn.gov.in/lake-level';

/**
 * The reservoirs whose surplus runs through the city, and the river each empties into.
 * Puzhal and Cholavaram also spill, but their channels are not named in the water map, so
 * they are shown to the visitor and left out of the assessment.
 */
export const DOWNSTREAM = [
  { reservoir: 'CHEMBARAMBAKKAM', label: 'Chembarambakkam', river: 'the Adyar', pattern: /adyar|adayar/i },
  { reservoir: 'POONDI', label: 'Poondi', river: 'the Kosasthalaiyar', pattern: /kosasthalaiyar|kortallaiyar/i },
] as const;

/**
 * These three numbers are judgements. The record gives them their scale: on 2 December
 * 2015 Chembarambakkam was 93% full and releasing 29,000 cusecs into the Adyar, and on
 * 4 December 2023 it was 81% full and releasing 3,279.
 */
export const RIVER_REACH_METRES = 500;
export const NEARLY_FULL_PERCENT = 80;
export const HEAVY_RELEASE_CUSECS = 3000;

export interface RiverExposure {
  readonly reading: ReservoirReading;
  readonly label: string;
  readonly river: string;
  readonly distanceMetres: number;
  readonly asOn: string;
}

function thousands(value: number): string {
  return Math.round(value).toLocaleString('en-IN');
}

/**
 * A street beside a river is exposed to the reservoir upstream as well as to the rain: a
 * release raises the river whether or not it is raining there. A heavy release counts
 * double, because by then the water is already on its way.
 */
export function reservoirFactor(exposure: RiverExposure | undefined): Factor | undefined {
  if (exposure === undefined || exposure.distanceMetres > RIVER_REACH_METRES) return undefined;
  const { reading, label, river, distanceMetres, asOn } = exposure;
  const releasing = (reading.outflowCusecs ?? 0) >= HEAVY_RELEASE_CUSECS;
  const nearlyFull = reading.storagePercent >= NEARLY_FULL_PERCENT;
  if (!releasing && !nearlyFull) return undefined;

  const state = `${label} reservoir was ${String(reading.storagePercent)}% full on ${asOn}`;
  const release = reading.outflowCusecs === null ? '' : ` and releasing ${thousands(reading.outflowCusecs)} cusecs`;
  return {
    id: 'RESERVOIR',
    title: releasing ? `${label} is releasing water` : `${label} is nearly full`,
    weight: releasing ? 2 : 1,
    evidence: {
      source: 'RESERVOIR',
      statement: `${state}${release} into ${river}, which is ${String(distanceMetres)} m from here`,
      link: RESERVOIR_SOURCE,
    },
  };
}
