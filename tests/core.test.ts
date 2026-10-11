import { describe, expect, it } from 'vitest';
import { addHours, assess, formatHour, levelFor, type AssessmentInput } from '../engine/src/core/assess.ts';
import { distanceMetres, median, ringAround } from '../engine/src/core/geo.ts';
import { classifyDailyRain, rainBefore } from '../engine/src/core/rain.ts';
import type { HourlyRain, Terrain } from '../engine/src/core/types.ts';
import { checkForecast, dailyChecks, summarize } from '../engine/src/core/verify.ts';
import { isInsideMap, nearestFloodedStreet, nearestWater, type WaterMap } from '../engine/src/core/water.ts';

const VELACHERY = { lat: 12.9756, lon: 80.2207 };

/** 72 dry hours of history, then 48 hours raining at a steady hourly rate. */
function series(mmPerHour: number, historyMmPerHour = 0): HourlyRain[] {
  return Array.from({ length: 120 }, (_, i) => ({
    time: addHours('2026-10-09T00:00', i),
    mm: i < 72 ? historyMmPerHour : mmPerHour,
  }));
}

const HIGH_GROUND: Terrain = { elevation: 20, surroundings: [20, 21, 19, 20] };
const LOW_GROUND: Terrain = { elevation: 2, surroundings: [2, 3, 2, 3] };
const BOWL: Terrain = { elevation: 3, surroundings: [8, 9, 7, 8] };

function input(overrides: Partial<AssessmentInput>): AssessmentInput {
  return { point: VELACHERY, series: series(0), nowIndex: 72, basis: 'FORECAST', terrain: HIGH_GROUND, mapped: true, ...overrides };
}

describe('classifyDailyRain', () => {
  it('uses the India Meteorological Department bounds', () => {
    expect(classifyDailyRain(15.5)).toBe('LIGHT');
    expect(classifyDailyRain(15.6)).toBe('MODERATE');
    expect(classifyDailyRain(64.5)).toBe('HEAVY');
    expect(classifyDailyRain(115.6)).toBe('VERY_HEAVY');
    expect(classifyDailyRain(204.5)).toBe('EXTREMELY_HEAVY');
  });

  it('puts a sum that falls in a published 0.1 mm gap in the lower class', () => {
    expect(classifyDailyRain(115.55)).toBe('HEAVY');
  });
});

describe('rainBefore', () => {
  it('sums only the hours inside the window and treats missing history as dry', () => {
    const hours = series(2);
    expect(rainBefore(hours, 78, 24)).toBe(12);
    expect(rainBefore(hours, 5, 24)).toBe(0);
  });
});

describe('levelFor', () => {
  it('never raises the level for a risky place under a dry sky', () => {
    expect(levelFor('LIGHT', 'HIGH')).toBe('LOW');
  });

  it('rates the same rain higher where the place is exposed', () => {
    expect(levelFor('VERY_HEAVY', 'NONE')).toBe('WATCH');
    expect(levelFor('VERY_HEAVY', 'SOME')).toBe('HIGH');
    expect(levelFor('VERY_HEAVY', 'HIGH')).toBe('SEVERE');
  });
});

describe('assess', () => {
  it('reports low risk with no peak when the forecast is dry', () => {
    const result = assess(input({ terrain: BOWL }));
    expect(result.level).toBe('LOW');
    expect(result.peak).toBeUndefined();
    expect(result.windows).toHaveLength(8);
  });

  it('finds no place factors on high, level ground away from water', () => {
    const result = assess(input({ series: series(6) }));
    expect(result.factors).toEqual([]);
    expect(result.susceptibility).toBe('NONE');
    expect(result.level).toBe('WATCH');
  });

  it('names low ground and a depression, and rates very heavy rain there severe', () => {
    const result = assess(input({ series: series(6), terrain: BOWL }));
    expect(result.factors.map((factor) => factor.id)).toEqual(['LOW_GROUND', 'DEPRESSION']);
    expect(result.susceptibility).toBe('HIGH');
    expect(result.level).toBe('SEVERE');
  });

  it('points the peak at the first window that reaches the overall level', () => {
    const result = assess(input({ series: series(6), terrain: LOW_GROUND }));
    // 6 mm an hour reaches heavy rain (64.5 mm) in the second six hour window.
    expect(result.windows[0]?.level).toBe('LOW');
    expect(result.peak?.start).toBe(result.windows.find((w) => w.level === result.level)?.start);
  });

  it('counts nearby water, and weighs water within 100 m more', () => {
    const near = assess(input({ nearestWater: { name: 'Velachery Lake', kind: 'lake', distanceMetres: 250 } }));
    const beside = assess(input({ nearestWater: { name: 'Velachery Lake', kind: 'lake', distanceMetres: 60 } }));
    const far = assess(input({ nearestWater: { name: 'Velachery Lake', kind: 'lake', distanceMetres: 900 } }));
    expect(near.susceptibility).toBe('SOME');
    expect(beside.susceptibility).toBe('HIGH');
    expect(far.factors).toEqual([]);
  });

  it('treats ground as soaked only after very heavy rain in the previous 72 hours', () => {
    const dayOfHeavyRain = assess(input({ series: series(0, 1) }));
    const threeWetDays = assess(input({ series: series(0, 2) }));
    expect(dayOfHeavyRain.factors).toEqual([]);
    expect(threeWetDays.factors.map((factor) => factor.id)).toEqual(['SATURATED']);
  });

  it('says so when the place is outside the Chennai maps', () => {
    const result = assess(input({ mapped: false }));
    expect(result.evidence.some((e) => e.statement.includes('outside the Chennai maps'))).toBe(true);
  });

  it('treats a street that flooded in 2015 as the strongest evidence', () => {
    const onStreet = assess(input({ series: series(6), floodedStreetMetres: 40 }));
    const nearby = assess(input({ series: series(6), floodedStreetMetres: 150 }));
    const far = assess(input({ series: series(6), floodedStreetMetres: 800 }));
    expect(onStreet.factors[0]).toMatchObject({ id: 'FLOODED_BEFORE', weight: 2 });
    expect(onStreet.level).toBe('SEVERE');
    expect(nearby.susceptibility).toBe('SOME');
    expect(far.factors).toEqual([]);
  });

  it('lets raised ground offset one risk factor', () => {
    const hill: Terrain = { elevation: 52, surroundings: [18, 20, 16, 19] };
    const result = assess(input({ series: series(6, 2), terrain: hill }));
    expect(result.factors.map((factor) => factor.id)).toEqual(['RAISED_GROUND', 'SATURATED']);
    expect(result.susceptibility).toBe('NONE');
  });

  it('labels the rating as a judgement and cites the rain classification', () => {
    const result = assess(input({ series: series(6), basis: 'REPLAY' }));
    expect(result.evidence[0]?.source).toBe('OBSERVED');
    expect(result.evidence[0]?.link).toContain('imd.gov.in');
    expect(result.evidence.at(-1)?.source).toBe('JUDGEMENT');
  });
});

describe('time helpers', () => {
  it('adds hours across a day and a month boundary', () => {
    expect(addHours('2026-10-31T20:00', 6)).toBe('2026-11-01T02:00');
  });

  it('formats an hour for a reader', () => {
    expect(formatHour('2026-10-12T18:00')).toBe('Mon 12 Oct, 6 PM');
    expect(formatHour('2026-10-12T00:00')).toBe('Mon 12 Oct, 12 AM');
  });
});

describe('geometry', () => {
  it('measures a kilometre ring at a kilometre', () => {
    for (const point of ringAround(VELACHERY, 1000, 8)) {
      expect(distanceMetres(VELACHERY, point)).toBeCloseTo(1000, 0);
    }
  });

  it('takes the median of an even and an odd list', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('water map', () => {
  const map: WaterMap = {
    bounds: [12.78, 79.98, 13.28, 80.35],
    names: ['Velachery Lake', ''],
    kinds: ['lake', 'canal'],
    points: [
      [12.9796, 80.2207, 0, 0],
      [13.1, 80.25, 1, 1],
    ],
  };

  it('finds the closest water and its name', () => {
    const found = nearestWater(map, VELACHERY);
    expect(found?.name).toBe('Velachery Lake');
    expect(found?.distanceMetres).toBeGreaterThan(400);
    expect(found?.distanceMetres).toBeLessThan(500);
  });

  it('knows which places it covers', () => {
    expect(isInsideMap(map, VELACHERY)).toBe(true);
    expect(isInsideMap(map, { lat: 28.61, lon: 77.2 })).toBe(false);
  });

  it('measures the distance to the nearest street that flooded, within a kilometre', () => {
    const history = { bounds: map.bounds, points: [[12.9765, 80.2207], [13.2, 80.3]] as [number, number][] };
    expect(nearestFloodedStreet(history, VELACHERY)).toBe(100);
    expect(nearestFloodedStreet(history, { lat: 12.9, lon: 80.1 })).toBeUndefined();
  });
});

describe('forecast checks', () => {
  it('matches when forecast and rainfall fall in the same class', () => {
    expect(checkForecast('2026-10-10', 70, 110).verdict).toBe('MATCHED');
  });

  it('names an under-forecast and an over-forecast', () => {
    expect(checkForecast('2026-10-10', 20, 130).verdict).toBe('UNDER_FORECAST');
    expect(checkForecast('2026-10-10', 90, 4).verdict).toBe('OVER_FORECAST');
  });

  it('checks only days with all 24 hours of both series', () => {
    const hours = [
      ...Array.from({ length: 24 }, (_, i) => ({ time: addHours('2026-10-09T00:00', i), observedMm: 3, dayAheadMm: 3 })),
      ...Array.from({ length: 10 }, (_, i) => ({ time: addHours('2026-10-10T00:00', i), observedMm: 1, dayAheadMm: null })),
    ];
    const checks = dailyChecks(hours);
    expect(checks.map((check) => check.date)).toEqual(['2026-10-09']);
    expect(checks[0]?.observedMm).toBe(72);
  });

  it('counts how many heavy rain days were forecast as heavy', () => {
    const record = summarize([
      checkForecast('2026-10-08', 80, 90),
      checkForecast('2026-10-09', 10, 120),
      checkForecast('2026-10-10', 2, 1),
    ]);
    expect(record).toEqual({ days: 3, matched: 2, underForecast: 1, overForecast: 0, heavyDays: 2, heavyDaysForecast: 1 });
  });
});
