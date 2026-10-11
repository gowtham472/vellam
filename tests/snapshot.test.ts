import { describe, expect, it } from 'vitest';
import { addHours } from '../engine/src/core/assess.ts';
import { MemoryRepository } from '../engine/src/api/repository.ts';
import { routeRequest } from '../engine/src/api/router.ts';
import { buildSnapshot, type ServiceDependencies } from '../engine/src/api/service.ts';
import type { HourlyRain, Snapshot } from '../engine/src/core/types.ts';
import placesData from '../engine/src/data/chennai-places.json' with { type: 'json' };

const NOW = new Date('2026-10-11T08:00:00Z');
const TOTAL = placesData.places.length;
const FIFTH = placesData.places[4] as (typeof placesData.places)[number];

function rain(mmPerHour: number): HourlyRain[] {
  return Array.from({ length: 144 }, (_, i) => ({ time: addHours('2026-10-08T00:00', i), mm: i < 85 ? 0 : mmPerHour }));
}

interface Harness extends ServiceDependencies {
  fetchForecast: ServiceDependencies["fetchForecast"];
  repository: MemoryRepository;
  alerts: { topic: string; subject: string; message: string }[];
  subscribed: { email: string; street: string | undefined }[];
  taken: boolean;
  mmPerHour: number;
}

function dependencies(mmPerHour: number): Harness {
  // Tests swap single dependencies, so the harness is built mutable.

  const harness: Harness = {
    mmPerHour,
    alerts: [],
    subscribed: [],
    taken: false,
    repository: new MemoryRepository(),
    fetchForecast: () => Promise.resolve({ series: rain(harness.mmPerHour), nowIndex: 85 }),
    fetchReplay: () => Promise.resolve({ series: rain(12), nowIndex: 72 }),
    fetchTerrain: () => Promise.resolve({ elevation: 9, surroundings: [8, 9, 10, 9] }),
    fetchForecastHistory: () => Promise.resolve([]),
    fetchReservoirs: () => Promise.resolve({ asOn: '2026-10-09', readings: [] }),
    publishAlert: (topic, subject, message) => {
      harness.alerts.push({ topic, subject, message });
      return Promise.resolve();
    },
    subscribeToAlerts: (email, street) => {
      if (harness.taken) return Promise.resolve(false);
      harness.subscribed.push({ email, street });
      return Promise.resolve(true);
    },
    now: () => NOW,
    newId: () => 'id',
  };
  return harness;
}

describe('buildSnapshot', () => {
  it('assesses every listed locality and stores the result for the map', async () => {
    const deps = dependencies(0);
    const snapshot = await buildSnapshot(deps);
    expect(snapshot.places.length).toBeGreaterThan(60);
    expect(snapshot.places.every((place) => place.level === 'LOW')).toBe(true);
    expect(snapshot.from).toBe('2026-10-11T13:00');
    expect(snapshot.windowStarts).toHaveLength(8);
    expect(snapshot.places[0]?.timeline).toHaveLength(8);
    const served = await routeRequest(deps, { method: 'GET', path: '/city', query: {} });
    expect((served.body as Snapshot).places).toHaveLength(snapshot.places.length);
  });

  it('stays silent while the forecast is dry', async () => {
    const deps = dependencies(0);
    await buildSnapshot(deps);
    expect(deps.alerts).toEqual([]);
  });

  it('alerts once when risk appears, not again while it lasts', async () => {
    const deps = dependencies(0);
    await buildSnapshot(deps);
    deps.mmPerHour = 9;
    // The hourly cache would otherwise serve the dry assessments again.
    deps.repository = new MemoryRepository();
    await deps.repository.saveSnapshot('LIVE', { basis: 'FORECAST', from: '', generatedAt: '', windowStarts: [], places: [], missing: [] });
    await buildSnapshot(deps);
    await buildSnapshot(deps);
    expect(deps.alerts).toHaveLength(1);
    expect(deps.alerts[0]?.topic).toBe('CITY');
    expect(deps.alerts[0]?.subject).toMatch(/^Vellam: flooding likely in \d+ Chennai localities$/);
    expect(deps.alerts[0]?.message).toContain('Velachery');
  });

  it('retries a place that failed, and names one that failed twice instead of failing the city', async () => {
    const deps = dependencies(0);
    let calls = 0;
    const steady = deps.fetchForecast;
    deps.fetchForecast = (point, now) => {
      calls += 1;
      // The third place fails once; the fifth fails every time.
      if (calls === 3 || point.lat === FIFTH.lat) return Promise.reject(new Error('The service is overloaded'));
      return steady(point, now);
    };
    const snapshot = await buildSnapshot(deps);
    expect(snapshot.missing).toEqual([FIFTH.name]);
    expect(snapshot.places).toHaveLength(TOTAL - 1);
  });

  it('fails outright only when no place at all can be assessed', async () => {
    const deps = dependencies(0);
    deps.fetchForecast = () => Promise.reject(new Error('The service is overloaded'));
    await expect(buildSnapshot(deps)).rejects.toThrow('No locality could be assessed');
  });

  it('stores a replay under its date and never alerts for the past', async () => {
    const deps = dependencies(0);
    const replay = await buildSnapshot(deps, '2023-12-04');
    expect(replay.basis).toBe('REPLAY');
    expect(deps.alerts).toEqual([]);
    expect((await routeRequest(deps, { method: 'GET', path: '/city', query: { date: '2023-12-04' } })).status).toBe(200);
    expect((await routeRequest(deps, { method: 'GET', path: '/city', query: {} })).status).toBe(404);
  });
});

describe('POST /alerts', () => {
  it('subscribes a valid address and asks it to confirm', async () => {
    const deps = dependencies(0);
    const response = await routeRequest(deps, { method: 'POST', path: '/alerts', query: {}, body: JSON.stringify({ email: 'resident@example.com' }) });
    expect(response.status).toBe(202);
    expect(deps.subscribed).toEqual([{ email: 'resident@example.com', street: undefined }]);
  });

  it('watches one street, storing the place without the address', async () => {
    const deps = dependencies(0);
    const response = await routeRequest(deps, {
      method: 'POST',
      path: '/alerts',
      query: {},
      body: JSON.stringify({ email: 'resident@example.com', lat: 12.97561, lon: 80.22069, name: 'Velachery' }),
    });
    expect(response.status).toBe(202);
    expect(deps.subscribed).toEqual([{ email: 'resident@example.com', street: '12.976,80.221' }]);
    expect([...deps.repository.watches.values()]).toEqual([{ key: '12.976,80.221', point: { lat: 12.97561, lon: 80.22069 }, name: 'Velachery' }]);
    expect(JSON.stringify([...deps.repository.watches.values()])).not.toContain('resident@example.com');
  });

  it('tells an address that is already subscribed how to change its street', async () => {
    const deps = dependencies(0);
    deps.taken = true;
    const response = await routeRequest(deps, { method: 'POST', path: '/alerts', query: {}, body: JSON.stringify({ email: 'resident@example.com', lat: 12.97, lon: 80.22 }) });
    expect(response.status).toBe(409);
    expect(deps.repository.watches.size).toBe(0);
  });

  it('alerts the watchers of a street once when it reaches high risk', async () => {
    const deps = dependencies(9);
    await deps.repository.saveWatch({ key: '12.976,80.221', point: { lat: 12.9756, lon: 80.2207 }, name: 'Velachery' });
    await buildSnapshot(deps);
    await buildSnapshot(deps);
    const street = deps.alerts.filter((alert) => alert.topic === '12.976,80.221');
    expect(street).toHaveLength(1);
    expect(street[0]?.subject).toMatch(/^Vellam: (HIGH|SEVERE) flood risk at Velachery$/);
    expect(street[0]?.message).toContain('What to do:');
    expect(deps.repository.watches.get('12.976,80.221')?.lastLevel).toMatch(/HIGH|SEVERE/);
  });

  it('rejects something that is not an email address', async () => {
    const deps = dependencies(0);
    const response = await routeRequest(deps, { method: 'POST', path: '/alerts', query: {}, body: JSON.stringify({ email: 'not an address' }) });
    expect(response.status).toBe(400);
    expect(deps.subscribed).toEqual([]);
  });
});
