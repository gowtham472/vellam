import { CheckCircleIcon, EyeIcon, SirenIcon, WarningIcon, type Icon } from '@phosphor-icons/react';
import type { Level } from '../../engine/src/core/types.ts';

export type Pose = 'happy' | 'calm' | 'look_left' | 'look_right' | 'alert' | 'dizzy' | 'wink' | 'mail' | 'sleepy' | 'code';

/**
 * How each level looks. The brand is red, so severe is a darker crimson and every level
 * also carries its own icon and mascot pose: nobody should have to tell two reds apart to
 * know how worried to be.
 */
export const LEVEL: Record<Level, { colour: string; icon: Icon; pose: Pose }> = {
  LOW: { colour: '#1f9d6b', icon: CheckCircleIcon, pose: 'happy' },
  WATCH: { colour: '#d99100', icon: EyeIcon, pose: 'look_right' },
  HIGH: { colour: '#e8590c', icon: WarningIcon, pose: 'alert' },
  SEVERE: { colour: '#8f1021', icon: SirenIcon, pose: 'dizzy' },
};

export const LEVELS: readonly Level[] = ['SEVERE', 'HIGH', 'WATCH', 'LOW'];
