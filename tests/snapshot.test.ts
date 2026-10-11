import { describe, expect, it } from 'vitest';
import { addHours } from '../engine/src/core/assess.ts';
import { MemoryRepository } from '../engine/src/api/repository.ts';
import { routeRequest } from '../engine/src/api/router.ts';
import { buildSnapshot, type ServiceDependencies } from '../engine/src/api/service.ts';
import type { HourlyRain, Snapshot } from '../engine/src/core/types.ts';

const NOW = new Date('2026-10-11T08:00:00Z');

function rain(mmPerHour: number): HourlyRain[] {
  return Array.from({ length: 144 }, (_, i) => ({ time: addHours('2026-10-08T00:00', i), mm: i < 85 ? 0 : mmPerHour }));
}

interface Harness extends ServiceDependencies {
  repository: MemoryRepository;
  alerts: { subject: string; message: string }[];
  subscribed: string[];
  mmPerHour: number;
}

function dependencies(mmPerHour: number): Harness {
  const harness: Harness = {
    mmPerHour,
    alerts: [],
    subscribed: [],
    repository: new MemoryRepository(),
    fetchForecast: () => Promise.resolve({ series: rain(harness.mmPerHour), nowIndex: 85 }),
    fetchReplay: () => Promise.resolve({ series: rain(12), nowIndex: 72 }),
    fetchTerrain: () => Promise.resolve({ elevation: 9, surroundings: [8, 9, 10, 9] }),
    fetchForecastHistory: () => Promise.resolve([]),
    publishAlert: (subject, message) => {
      harness.alerts.push({ subject, message });
      return Promise.resolve();
    },
    subscribeToAlerts: (email) => {
      harness.subscribed.push(email);
      return Promise.resolve();
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
    await deps.repository.saveSnapshot('LIVE', { basis: 'FORECAST', from: '', generatedAt: '', places: [] });
    await buildSnapshot(deps);
    await buildSnapshot(deps);
    expect(deps.alerts).toHaveLength(1);
    expect(deps.alerts[0]?.subject).toMatch(/^Vellam: flooding likely in \d+ Chennai localities$/);
    expect(deps.alerts[0]?.message).toContain('Velachery');
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
    expect(deps.subscribed).toEqual(['resident@example.com']);
  });

  it('rejects something that is not an email address', async () => {
    const deps = dependencies(0);
    const response = await routeRequest(deps, { method: 'POST', path: '/alerts', query: {}, body: JSON.stringify({ email: 'not an address' }) });
    expect(response.status).toBe(400);
    expect(deps.subscribed).toEqual([]);
  });
});
