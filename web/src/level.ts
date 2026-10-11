import { CheckCircleIcon, EyeIcon, SirenIcon, WarningIcon, type Icon } from '@phosphor-icons/react';
import type { EvidenceSource, Level } from '../../engine/src/core/types.ts';
import type { Mood } from './components/Mascot.tsx';

/**
 * How each level looks. The brand is red, so severe is a darker crimson and every level
 * also carries its own icon and mascot mood: nobody should have to tell two reds apart to
 * know how worried to be.
 */
export const LEVEL: Record<Level, { colour: string; icon: Icon; mood: Mood }> = {
  LOW: { colour: '#1f9d6b', icon: CheckCircleIcon, mood: 'happy' },
  WATCH: { colour: '#d99100', icon: EyeIcon, mood: 'watch' },
  HIGH: { colour: '#e8590c', icon: WarningIcon, mood: 'alert' },
  SEVERE: { colour: '#8f1021', icon: SirenIcon, mood: 'dizzy' },
};

export const LEVELS: readonly Level[] = ['SEVERE', 'HIGH', 'WATCH', 'LOW'];

/** The label beside each fact, saying what kind of thing it is. */
export const SOURCE_LABEL: Record<EvidenceSource, string> = {
  FORECAST: 'Forecast',
  OBSERVED: 'Measured',
  TERRAIN: 'Terrain',
  MAP: 'Map',
  HISTORY: '2015 record',
  RESERVOIR: 'Reservoir',
  REPORT: 'Neighbours',
  JUDGEMENT: 'Judgement',
};
