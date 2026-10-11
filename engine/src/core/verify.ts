import { classifyDailyRain, rankOfRainClass, roundMm } from './rain.ts';
import type { ForecastCheck } from './types.ts';

/** One hour with the rain that fell and the rain forecast for that hour one day earlier. */
export interface CheckedHour {
  readonly time: string;
  readonly observedMm: number | null;
  readonly dayAheadMm: number | null;
}

/**
 * Compares the day-ahead forecast with what fell, one calendar day at a time. A forecast
 * counts as matched when both land in the same IMD rain class, because the class is what
 * decides the risk level; being 3 mm out inside a class changes nothing a resident does.
 */
export function checkForecast(date: string, forecastMm: number, observedMm: number): ForecastCheck {
  const forecastClass = classifyDailyRain(forecastMm);
  const observedClass = classifyDailyRain(observedMm);
  const difference = rankOfRainClass(forecastClass) - rankOfRainClass(observedClass);
  return {
    date,
    forecastMm: roundMm(forecastMm),
    observedMm: roundMm(observedMm),
    forecastClass,
    observedClass,
    verdict: difference === 0 ? 'MATCHED' : difference < 0 ? 'UNDER_FORECAST' : 'OVER_FORECAST',
  };
}

/** Groups hours into days and checks each day that has all 24 hours of both series. */
export function dailyChecks(hours: readonly CheckedHour[]): ForecastCheck[] {
  const days = new Map<string, { observed: number; forecast: number; complete: number }>();
  for (const hour of hours) {
    if (hour.observedMm === null || hour.dayAheadMm === null) continue;
    const date = hour.time.slice(0, 10);
    const day = days.get(date) ?? { observed: 0, forecast: 0, complete: 0 };
    day.observed += hour.observedMm;
    day.forecast += hour.dayAheadMm;
    day.complete += 1;
    days.set(date, day);
  }
  return [...days.entries()]
    .filter(([, day]) => day.complete === 24)
    .map(([date, day]) => checkForecast(date, day.forecast, day.observed))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface TrackRecord {
  readonly days: number;
  readonly matched: number;
  readonly underForecast: number;
  readonly overForecast: number;
  /** Days on which heavy rain or more actually fell, and how many of those were forecast as such. */
  readonly heavyDays: number;
  readonly heavyDaysForecast: number;
}

export function summarize(checks: readonly ForecastCheck[]): TrackRecord {
  const heavy = checks.filter((check) => rankOfRainClass(check.observedClass) >= rankOfRainClass('HEAVY'));
  return {
    days: checks.length,
    matched: checks.filter((check) => check.verdict === 'MATCHED').length,
    underForecast: checks.filter((check) => check.verdict === 'UNDER_FORECAST').length,
    overForecast: checks.filter((check) => check.verdict === 'OVER_FORECAST').length,
    heavyDays: heavy.length,
    heavyDaysForecast: heavy.filter((check) => rankOfRainClass(check.forecastClass) >= rankOfRainClass('HEAVY')).length,
  };
}
