import type { Level } from './types.ts';

export interface Guidance {
  readonly headline: string;
  readonly actions: readonly string[];
}

export interface Helpline {
  readonly number: string;
  readonly en: string;
  /** Where the number answers. A city's own line is offered only inside that city. */
  readonly reach: 'INDIA' | 'CHENNAI';
}

/**
 * 112 is the national emergency number and 1078 the National Disaster Management
 * Authority's control room. 1070 reaches the state control room in most states. 1913 is the
 * Greater Chennai Corporation, from the Tamil Nadu disaster telephone directory.
 */
export const HELPLINES: readonly Helpline[] = [
  { number: '112', en: 'Emergency, anywhere in India', reach: 'INDIA' },
  { number: '1078', en: 'National disaster helpline', reach: 'INDIA' },
  { number: '1070', en: 'State emergency control room', reach: 'INDIA' },
  { number: '1913', en: 'Greater Chennai Corporation', reach: 'CHENNAI' },
];

export const HELPLINE_SOURCE = 'https://www.tnsdma.tn.gov.in/app/webroot/img/2022/DisasterTelephoneBook_2023.pdf';

/**
 * What to do at each level. The steps follow the National Disaster Management Authority's
 * flood guidance, ordered so the ones that take longest come first: a vehicle has to be
 * moved before the street floods, a phone can be charged later. The interface translates
 * these by position, so a step added here needs a line in each language file.
 */
const GUIDANCE: Record<Level, Guidance> = {
  LOW: {
    headline: 'No flooding expected here in the next 48 hours',
    actions: [
      'Nothing to do now. Check again when the forecast changes.',
    ],
  },
  WATCH: {
    headline: 'Water may collect on low streets here',
    actions: [
      'Move vehicles out of basements and low parking spots.',
      'Clear the drain outside your home if it is safe to do so.',
      'Charge phones and power banks.',
      'Check on elderly neighbours and anyone living on a ground floor.',
    ],
  },
  HIGH: {
    headline: 'Flooding is likely here',
    actions: [
      'Move vehicles, documents and valuables to higher ground or an upper floor now.',
      'Store drinking water and food for two days, and keep medicines within reach.',
      'Stay out of basements, subways and underpasses.',
      'Do not walk or ride through moving water.',
      'Switch off the mains if water enters the house.',
    ],
  },
  SEVERE: {
    headline: 'Serious flooding is likely here',
    actions: [
      'Be ready to leave. Pack documents, medicines, drinking water, a torch and a charged phone.',
      'Move to an upper floor, or to a relief centre if water starts rising.',
      'Switch off electricity and gas before water reaches the sockets.',
      'Stay away from fallen power lines and electric poles.',
      'Call 112 if you or a neighbour need help.',
    ],
  },
};

export const GUIDANCE_SOURCE = 'https://ndma.gov.in/Natural-Hazards/Floods/Dos-Donts';

export function guidanceFor(level: Level): Guidance {
  return GUIDANCE[level];
}
