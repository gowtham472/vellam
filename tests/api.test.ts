import { describe, expect, it } from 'vitest';
import { addHours } from '../engine/src/core/assess.ts';
import { MemoryRepository, placeKey, reportCellsAround } from '../engine/src/api/repository.ts';
import { routeRequest } from '../engine/src/api/router.ts';
import type { PlaceView, ServiceDependencies, TrackRecordResult } from '../engine/src/api/service.ts';
import type { HourlyRain, WaterReport } from '../engine/src/core/types.ts';
import waterData from '../engine/src/data/chennai-water.json' with { type: 'json' };

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
    fetchReservoirs: () => Promise.resolve({ asOn: '2026-10-09', readings: [] }),
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

describe('reservoirs', () => {
  // A real point on the Adyar from the water map, so the test uses the map the service uses.
  const adyar = waterData.points.find((point) => waterData.names[point[2] ?? -1] === 'Adyar River') ?? [0, 0];
  const beside = { lat: String(adyar[0]), lon: String(adyar[1]) };
  const releasing = { asOn: '2015-12-02', readings: [{ name: 'CHEMBARAMBAKKAM', capacityMcft: 3645, storageMcft: 3396, storagePercent: 93.17, inflowCusecs: 26000, outflowCusecs: 29000 }] };

  it('warns a street beside the Adyar when Chembarambakkam is releasing heavily', async () => {
    const deps = dependencies({ fetchReservoirs: () => Promise.resolve(releasing) });
    const { body } = await get<PlaceView>(deps, '/assess', beside);
    expect(body.assessment.factors.map((factor) => factor.id)).toContain('RESERVOIR');
    expect(body.assessment.evidence.some((item) => item.source === 'RESERVOIR' && item.statement.includes('29,000 cusecs'))).toBe(true);
  });

  it('asks for the bulletin from inside the replayed 48 hours, and only for streets beside a river', async () => {
    const asked: (string | undefined)[] = [];
    const deps = dependencies({
      fetchReservoirs: (date) => {
        asked.push(date);
        return Promise.resolve(releasing);
      },
    });
    await get(deps, '/assess', { ...beside, date: '2015-12-01' });
    await get(deps, '/assess', { lat: '13.1240', lon: '80.2120' });
    expect(asked).toEqual(['2015-12-02']);
  });

  it('still answers when the bulletin cannot be read', async () => {
    const deps = dependencies({ fetchReservoirs: () => Promise.reject(new Error('timed out')) });
    const { status, body } = await get<PlaceView>(deps, '/assess', beside);
    expect(status).toBe(200);
    expect(body.assessment.factors.map((factor) => factor.id)).not.toContain('RESERVOIR');
  });

  it('serves the bulletin and fetches it once', async () => {
    let fetched = 0;
    const deps = dependencies({
      fetchReservoirs: () => {
        fetched += 1;
        return Promise.resolve(releasing);
      },
    });
    const first = await get<{ asOn: string }>(deps, '/reservoirs', {});
    await get(deps, '/reservoirs', {});
    expect(first.body.asOn).toBe('2015-12-02');
    expect(fetched).toBe(1);
  });
});

describe('reports', () => {
  it('counts one report once at a spot where neighbouring cells used to coincide', async () => {
    const deps = dependencies({ fetchForecast: () => Promise.resolve({ series: rain(0), nowIndex: 85 }) });
    await routeRequest(deps, { method: 'POST', path: '/reports', query: {}, body: JSON.stringify({ lat: 13.0601, lon: 80.3601, depth: 'KNEE' }) });
    const { body } = await get<PlaceView>(deps, '/assess', { lat: '13.06', lon: '80.36' });
    expect(body.reports).toHaveLength(1);
    expect(body.assessment.level).toBe('WATCH');
  });

  it('raises a dry forecast to high once two neighbours report knee deep water nearby', async () => {
    const deps = dependencies({ fetchForecast: () => Promise.resolve({ series: rain(0), nowIndex: 85 }) });
    const send = () => routeRequest(deps, { method: 'POST', path: '/reports', query: {}, body: JSON.stringify({ lat: 12.9758, lon: 80.2209, depth: 'KNEE' }) });
    expect((await get<PlaceView>(deps, '/assess', VELACHERY)).body.assessment.level).toBe('LOW');
    await send();
    expect((await get<PlaceView>(deps, '/assess', VELACHERY)).body.assessment.level).toBe('WATCH');
    await send();
    const after = (await get<PlaceView>(deps, '/assess', VELACHERY)).body;
    expect(after.assessment.level).toBe('HIGH');
    expect(after.assessment.raisedByReports).toBe(true);
    expect(after.guidance.en.headline).toBe('Flooding is likely here');
  });

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

  it('never searches the same cell twice, even where the coordinates divide badly', () => {
    // Found on the live API: at this spot one report was read back as two.
    expect(new Set(reportCellsAround({ lat: 13.06, lon: 80.36 })).size).toBe(9);
    for (let lat = 12.8; lat < 13.3; lat += 0.013) {
      for (let lon = 80.0; lon < 80.4; lon += 0.017) {
        expect(new Set(reportCellsAround({ lat, lon })).size).toBe(9);
      }
    }
  });
});
