import { describe, expect, it } from 'vitest';
import { addHours } from '../engine/src/core/assess.ts';
import { MemoryRepository, placeKey, reportCellsAround } from '../engine/src/api/repository.ts';
import { routeRequest } from '../engine/src/api/router.ts';
import type { PlaceView, ServiceDependencies, TrackRecordResult } from '../engine/src/api/service.ts';
import type { HourlyRain, WaterReport } from '../engine/src/core/types.ts';

const NOW = new Date('2026-10-11T08:00:00Z'); // 13:30 in Chennai
const VELACHERY = { lat: '12.9756', lon: '80.2207' };

function rain(mmPerHour: number): HourlyRain[] {
  return Array.from({ length: 144 }, (_, i) => ({ time: addHours('2026-10-08T00:00', i), mm: i < 85 ? 0 : mmPerHour }));
}

function dependencies(overrides: Partial<ServiceDependencies> = {}): ServiceDependencies & { repository: MemoryRepository; calls: string[] } {
  const calls: string[] = [];
  let id = 0;
  return {
    calls,
    repository: new MemoryRepository(),
    fetchForecast: () => {
      calls.push('forecast');
      return Promise.resolve({ series: rain(6), nowIndex: 85 });
    },
    fetchReplay: (_point, date) => {
      calls.push(`replay ${date}`);
      return Promise.resolve({ series: rain(10), nowIndex: 72 });
    },
    fetchTerrain: () => {
      calls.push('terrain');
      return Promise.resolve({ elevation: 9, surroundings: [8, 9, 10, 9] });
    },
    fetchForecastHistory: () =>
      Promise.resolve(Array.from({ length: 48 }, (_, i) => ({ time: addHours('2026-10-09T00:00', i), observedMm: i < 24 ? 4 : 0, dayAheadMm: 1 }))),
    now: () => NOW,
    newId: () => `report-${String((id += 1))}`,
    ...overrides,
  } as ServiceDependencies & { repository: MemoryRepository; calls: string[] };
}

async function get<T>(deps: ServiceDependencies, path: string, query: Record<string, string>): Promise<{ status: number; body: T }> {
  const response = await routeRequest(deps, { method: 'GET', path, query });
  return { status: response.status, body: response.body as T };
}

describe('GET /assess', () => {
  it('returns the assessment with guidance in both languages and the helplines', async () => {
    const { status, body } = await get<PlaceView>(dependencies(), '/assess', VELACHERY);
    expect(status).toBe(200);
    expect(body.assessment.basis).toBe('FORECAST');
    expect(body.assessment.from).toBe('2026-10-11T13:00');
    expect(body.guidance.en.actions.length).toBeGreaterThan(0);
    expect(body.guidance.ta.headline).not.toBe(body.guidance.en.headline);
    expect(body.helplines.map((line) => line.number)).toContain('1913');
  });

  it('uses the flood record and water map for a Chennai place', async () => {
    const { body } = await get<PlaceView>(dependencies(), '/assess', VELACHERY);
    expect(body.assessment.mapped).toBe(true);
    expect(body.assessment.nearestWater).toBeDefined();
  });

  it('fetches terrain once per place and the forecast once per hour', async () => {
    const deps = dependencies();
    await get(deps, '/assess', VELACHERY);
    await get(deps, '/assess', VELACHERY);
    expect(deps.calls).toEqual(['forecast', 'terrain']);
  });

  it('replays a past date from the record without caching it as the live answer', async () => {
    const deps = dependencies();
    const replay = await get<PlaceView>(deps, '/assess', { ...VELACHERY, date: '2023-12-04' });
    const live = await get<PlaceView>(deps, '/assess', VELACHERY);
    expect(replay.body.assessment.basis).toBe('REPLAY');
    expect(live.body.assessment.basis).toBe('FORECAST');
    expect(deps.calls).toEqual(['replay 2023-12-04', 'terrain', 'forecast']);
  });

  it('rejects a missing place, a place outside India and a malformed date', async () => {
    const deps = dependencies();
    expect((await get(deps, '/assess', {})).status).toBe(400);
    expect((await get(deps, '/assess', { lat: '51.5', lon: '-0.12' })).status).toBe(400);
    expect((await get(deps, '/assess', { ...VELACHERY, date: 'yesterday' })).status).toBe(400);
  });

  it('answers 502 with a plain message when a source fails', async () => {
    const deps = dependencies({ fetchForecast: () => Promise.reject(new Error('https://api.example/secret-path timed out')) });
    const { status, body } = await get<{ message: string }>(deps, '/assess', VELACHERY);
    expect(status).toBe(502);
    expect(body.message).not.toContain('secret-path');
  });
});

describe('reports', () => {
  it('stores a report and returns it to people nearby, newest first', async () => {
    const deps = dependencies();
    const created = await routeRequest(deps, { method: 'POST', path: '/reports', query: {}, body: JSON.stringify({ lat: 12.9761, lon: 80.2211, depth: 'KNEE' }) });
    expect(created.status).toBe(201);
    const { body } = await get<WaterReport[]>(deps, '/reports', VELACHERY);
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({ depth: 'KNEE', at: NOW.toISOString() });
  });

  it('keeps nothing that identifies the person', async () => {
    const deps = dependencies();
    await routeRequest(deps, { method: 'POST', path: '/reports', query: {}, body: JSON.stringify({ lat: 12.9761, lon: 80.2211, depth: 'ANKLE', name: 'Kumar', phone: '9999999999' }) });
    expect(Object.keys(deps.repository.reports[0] ?? {}).sort()).toEqual(['at', 'depth', 'id', 'point']);
  });

  it('hides reports from far away and reports older than 48 hours', async () => {
    const deps = dependencies();
    deps.repository.reports.push(
      { id: 'far', point: { lat: 13.0, lon: 80.2207 }, depth: 'WAIST', at: NOW.toISOString() },
      { id: 'old', point: { lat: 12.9756, lon: 80.2207 }, depth: 'WAIST', at: '2026-10-08T00:00:00.000Z' },
    );
    expect((await get<WaterReport[]>(deps, '/reports', VELACHERY)).body).toEqual([]);
  });

  it('rejects an unknown depth and a body that is not JSON', async () => {
    const deps = dependencies();
    const badDepth = await routeRequest(deps, { method: 'POST', path: '/reports', query: {}, body: JSON.stringify({ lat: 12.97, lon: 80.22, depth: 'DEEP' }) });
    const notJson = await routeRequest(deps, { method: 'POST', path: '/reports', query: {}, body: 'water!' });
    expect(badDepth.status).toBe(400);
    expect(notJson.status).toBe(400);
  });
});

describe('GET /track-record', () => {
  it('compares the day-ahead forecast with what fell, day by day', async () => {
    const { body } = await get<TrackRecordResult>(dependencies(), '/track-record', VELACHERY);
    expect(body.checks.map((check) => [check.date, check.forecastMm, check.observedMm, check.verdict])).toEqual([
      ['2026-10-09', 24, 96, 'UNDER_FORECAST'],
      ['2026-10-10', 24, 0, 'OVER_FORECAST'],
    ]);
    expect(body.record.heavyDays).toBe(1);
    expect(body.record.heavyDaysForecast).toBe(0);
  });
});

describe('routing', () => {
  it('lists the Chennai localities and answers 404 elsewhere', async () => {
    const deps = dependencies();
    const places = await get<{ name: string }[]>(deps, '/places', {});
    expect(places.body.some((place) => place.name === 'Velachery')).toBe(true);
    expect((await get(deps, '/nowhere', {})).status).toBe(404);
  });
});

describe('storage keys', () => {
  it('keys a place to about 110 metres', () => {
    expect(placeKey({ lat: 12.97561, lon: 80.22069 })).toBe('12.976,80.221');
  });

  it('searches the cell a point is in and the eight around it', () => {
    expect(new Set(reportCellsAround({ lat: 12.9756, lon: 80.2207 })).size).toBe(9);
  });
});
