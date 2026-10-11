import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addHours, assess } from '../engine/src/core/assess.ts';
import { applyReports, reportFloor, type NearbyReport } from '../engine/src/core/reports.ts';
import { reservoirFactor, type ReservoirReading, type RiverExposure } from '../engine/src/core/reservoirs.ts';
import type { HourlyRain } from '../engine/src/core/types.ts';
import { nearestNamedWater, type WaterMap } from '../engine/src/core/water.ts';
import { parseReservoirPage } from '../engine/src/sources/reservoirs.ts';

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

function reading(storagePercent: number, outflowCusecs: number | null): ReservoirReading {
  return { name: 'CHEMBARAMBAKKAM', capacityMcft: 3645, storageMcft: 3645 * (storagePercent / 100), storagePercent, inflowCusecs: 200, outflowCusecs };
}

function exposure(storagePercent: number, outflowCusecs: number | null, distanceMetres = 320): RiverExposure {
  return { reading: reading(storagePercent, outflowCusecs), label: 'Chembarambakkam', river: 'the Adyar', distanceMetres, asOn: '2026-10-09' };
}

describe('parseReservoirPage', () => {
  it('reads the bulletin for the day of the 2015 flood', () => {
    const report = parseReservoirPage(fixture('lake-level-2015-12-02.html'));
    expect(report.asOn).toBe('2015-12-02');
    expect(report.readings.find((r) => r.name === 'CHEMBARAMBAKKAM')).toEqual({
      name: 'CHEMBARAMBAKKAM',
      capacityMcft: 3645,
      storageMcft: 3396,
      storagePercent: 93.17,
      inflowCusecs: 26000,
      outflowCusecs: 29000,
    });
  });

  it('reads the bulletin for the day Cyclone Michaung hit and leaves out the total row', () => {
    const report = parseReservoirPage(fixture('lake-level-2023-12-04.html'));
    expect(report.readings.map((r) => r.name)).not.toContain('TOTAL');
    expect(report.readings.find((r) => r.name === 'CHEMBARAMBAKKAM')).toMatchObject({ storagePercent: 80.77, outflowCusecs: 3279 });
    expect(report.readings.length).toBeGreaterThanOrEqual(5);
  });

  it('refuses a page that is not the bulletin instead of returning nothing', () => {
    expect(() => parseReservoirPage('<html><body>Service unavailable</body></html>')).toThrow(/layout may have changed/);
  });
});

describe('reservoirFactor', () => {
  it('ignores a reservoir that is neither nearly full nor releasing heavily', () => {
    expect(reservoirFactor(exposure(34.4, 144))).toBeUndefined();
  });

  it('counts a nearly full reservoir once', () => {
    expect(reservoirFactor(exposure(86, 200))).toMatchObject({ id: 'RESERVOIR', weight: 1, title: 'Chembarambakkam is nearly full' });
  });

  it('counts a heavy release double and says how much, where, and when', () => {
    const factor = reservoirFactor(exposure(93.17, 29000));
    expect(factor).toMatchObject({ weight: 2, title: 'Chembarambakkam is releasing water' });
    expect(factor?.evidence.statement).toBe(
      'Chembarambakkam reservoir was 93.17% full on 2026-10-09 and releasing 29,000 cusecs into the Adyar, which is 320 m from here',
    );
    expect(factor?.evidence.source).toBe('RESERVOIR');
  });

  it('applies only to streets within 500 m of the river', () => {
    expect(reservoirFactor(exposure(93, 29000, 900))).toBeUndefined();
    expect(reservoirFactor(undefined)).toBeUndefined();
  });

  it('makes very heavy rain severe beside a river whose reservoir is releasing', () => {
    const series: HourlyRain[] = Array.from({ length: 120 }, (_, i) => ({ time: addHours('2026-10-09T00:00', i), mm: i < 72 ? 0 : 6 }));
    const base = { point: { lat: 13.02, lon: 80.22 }, series, nowIndex: 72, basis: 'FORECAST' as const, terrain: { elevation: 12, surroundings: [12, 13, 12, 12] }, mapped: true };
    expect(assess(base).level).toBe('WATCH');
    expect(assess({ ...base, riverExposure: exposure(93, 29000) }).level).toBe('SEVERE');
  });
});

describe('nearestNamedWater', () => {
  const map: WaterMap = {
    bounds: [12.78, 79.98, 13.28, 80.35],
    names: ['Adyar River', 'Velachery Lake'],
    kinds: ['river', 'lake'],
    points: [
      [13.0166, 80.22, 0, 0],
      [13.0201, 80.22, 1, 1],
    ],
  };

  it('measures to the named river, not to closer water with another name', () => {
    expect(nearestNamedWater(map, { lat: 13.02, lon: 80.22 }, /adyar/i)).toBe(378);
    expect(nearestNamedWater(map, { lat: 13.02, lon: 80.22 }, /cooum/i)).toBeUndefined();
  });
});

describe('reports from neighbours', () => {
  const report = (depth: NearbyReport['depth'], distanceMetres = 120, hoursAgo = 1): NearbyReport => ({ depth, distanceMetres, hoursAgo });

  it('lets one report raise the level to watch, and no further', () => {
    const floor = reportFloor([report('WAIST')]);
    expect(floor?.level).toBe('WATCH');
    expect(floor?.evidence.statement).toContain('One report alone raises the level to WATCH');
  });

  it('needs two reports that agree to reach high or severe', () => {
    expect(reportFloor([report('KNEE'), report('KNEE', 250)])?.level).toBe('HIGH');
    expect(reportFloor([report('WAIST'), report('KNEE')])?.level).toBe('HIGH');
    expect(reportFloor([report('WAIST'), report('WAIST', 40)])?.level).toBe('SEVERE');
  });

  it('ignores reports that are far away, old, or of no water', () => {
    expect(reportFloor([report('WAIST', 400), report('WAIST', 100, 7), report('NONE')])).toBeUndefined();
  });

  it('raises a dry forecast and puts the reason first', () => {
    const series: HourlyRain[] = Array.from({ length: 120 }, (_, i) => ({ time: addHours('2026-10-09T00:00', i), mm: 0 }));
    const dry = assess({ point: { lat: 13.02, lon: 80.22 }, series, nowIndex: 72, basis: 'FORECAST', terrain: { elevation: 12, surroundings: [12, 12] }, mapped: true });
    const raised = applyReports(dry, [report('KNEE'), report('KNEE', 90)]);
    expect(dry.level).toBe('LOW');
    expect(raised.level).toBe('HIGH');
    expect(raised.raisedByReports).toBe(true);
    expect(raised.evidence[0]?.source).toBe('REPORT');
  });

  it('never lowers a level the forecast already set higher', () => {
    const series: HourlyRain[] = Array.from({ length: 120 }, (_, i) => ({ time: addHours('2026-10-09T00:00', i), mm: i < 72 ? 0 : 10 }));
    const wet = assess({ point: { lat: 13.02, lon: 80.22 }, series, nowIndex: 72, basis: 'FORECAST', terrain: { elevation: 12, surroundings: [12, 12] }, mapped: true, floodedStreetMetres: 20 });
    const after = applyReports(wet, [report('ANKLE')]);
    expect(after.level).toBe(wet.level);
    expect(after.raisedByReports).toBe(false);
  });
});
