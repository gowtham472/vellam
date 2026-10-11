import type { HourlyRain, RainClass } from './types.ts';

export const IMD_CLASSIFICATION_URL =
  'https://rsmcnewdelhi.imd.gov.in/uploads/archive/8/8_f9822f_heavy%20rainfall%201506.pdf';

const CLASS_ORDER: readonly RainClass[] = ['LIGHT', 'MODERATE', 'HEAVY', 'VERY_HEAVY', 'EXTREMELY_HEAVY'];

const CLASS_LABEL: Record<RainClass, string> = {
  LIGHT: 'light rain or none (under 15.6 mm)',
  MODERATE: 'moderate rain (15.6 to 64.4 mm)',
  HEAVY: 'heavy rain (64.5 to 115.5 mm)',
  VERY_HEAVY: 'very heavy rain (115.6 to 204.4 mm)',
  EXTREMELY_HEAVY: 'extremely heavy rain (204.5 mm or more)',
};

/**
 * IMD's classes for rain over 24 hours. Its bulletins leave 0.1 mm gaps between classes
 * because gauges report to one decimal; a computed sum can land in a gap, so each class
 * here starts at its published lower bound and runs up to the next.
 */
export function classifyDailyRain(mm: number): RainClass {
  if (mm >= 204.5) return 'EXTREMELY_HEAVY';
  if (mm >= 115.6) return 'VERY_HEAVY';
  if (mm >= 64.5) return 'HEAVY';
  if (mm >= 15.6) return 'MODERATE';
  return 'LIGHT';
}

export function describeRainClass(rainClass: RainClass): string {
  return CLASS_LABEL[rainClass];
}

export function rankOfRainClass(rainClass: RainClass): number {
  return CLASS_ORDER.indexOf(rainClass);
}

/** Rain in the `hours` hours that end just before `endIndex`. Hours before the series count as dry. */
export function rainBefore(series: readonly HourlyRain[], endIndex: number, hours: number): number {
  let total = 0;
  for (let i = Math.max(0, endIndex - hours); i < Math.min(endIndex, series.length); i += 1) {
    total += series[i]?.mm ?? 0;
  }
  return roundMm(total);
}

export function roundMm(mm: number): number {
  return Math.round(mm * 10) / 10;
}
