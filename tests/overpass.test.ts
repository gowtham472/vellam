import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addHours } from '../engine/src/core/assess.ts';
import { MemoryRepository } from '../engine/src/api/repository.ts';
import { assessPlace, buildSnapshot, type ServiceDependencies } from '../engine/src/api/service.ts';
import { nearestNamedWater, nearestWater } from '../engine/src/core/water.ts';
import { parseNearbyWater } from '../engine/src/sources/overpass.ts';

const KURLA = { lat: 19.07128, lon: 72.88304 };
const answer: unknown = JSON.parse(readFileSync(new URL('./fixtures/overpass-kurla.json', import.meta.url), 'utf8'));

describe('parseNearbyWater', () => {
  it('reads a captured answer for Kurla, Mumbai, into the water map shape', () => {
    const map = parseNearbyWater(answer, KURLA);
    expect(map.names).toEqual(['', 'Mithi River']);
    expect(map.kinds).toEqual(['drain', 'river']);
    expect(nearestWater(map, KURLA)).toEqual({ name: '', kind: 'drain', distanceMetres: 139 });
    expect(nearestNamedWater(map, KURLA, /mithi/i)).toBeGreaterThan(139);
  });

  it('refuses an answer that is not a list of map elements', () => {
    expect(() => parseNearbyWater({ remark: 'runtime error: out of memory' }, KURLA)).toThrow(/format may have changed/);
  });
});

describe('water outside Chennai', () => {
  function dependencies(fetchNearbyWater: ServiceDependencies['fetchNearbyWater']): ServiceDependencies & { lookups: number } {
    const deps = {
      lookups: 0,
      repository: new MemoryRepository(),
      fetchForecast: () => Promise.resolve({ series: Array.from({ length: 144 }, (_, i) => ({ time: addHours('2026-10-08T00:00', i), mm: 0 })), nowIndex: 85 }),
      fetchReplay: () => Promise.reject(new Error('not used')),
      fetchTerrain: () => Promise.resolve({ elevation: 9, surroundings: [8, 9, 10, 9] }),
      fetchForecastHistory: () => Promise.resolve([]),
      fetchReservoirs: () => Promise.resolve({ asOn: '2026-10-09', readings: [] }),
      now: () => new Date('2026-10-11T08:00:00Z'),
      newId: () => 'id',
      ...(fetchNearbyWater === undefined
        ? {}
        : {
            fetchNearbyWater: (point: typeof KURLA) => {
              deps.lookups += 1;
              return fetchNearbyWater(point);
            },
          }),
    };
    return deps;
  }

  it('looks the water up, counts it as a factor, and says where it came from', async () => {
    const deps = dependencies((point) => Promise.resolve(parseNearbyWater(answer, point)));
    const assessment = await assessPlace(deps, KURLA);
    expect(assessment.mapped).toBe(false);
    expect(assessment.nearestWater).toEqual({ name: '', kind: 'drain', distanceMetres: 139 });
    expect(assessment.factors.map((factor) => factor.id)).toContain('NEAR_WATER');
    expect(assessment.evidence.some((item) => item.statement.includes('read from OpenStreetMap'))).toBe(true);
  });

  it('looks a place up once and remembers a place with no water near it', async () => {
    const deps = dependencies((point) => Promise.resolve(parseNearbyWater({ elements: [] }, point)));
    const first = await assessPlace(deps, KURLA);
    deps.now = () => new Date('2026-10-11T10:00:00Z');
    await assessPlace(deps, KURLA);
    expect(first.nearestWater).toBeUndefined();
    expect(first.waterSearched).toBe(true);
    expect(deps.lookups).toBe(1);
  });

  it('still answers when the map cannot be read, says so, and tries again next time', async () => {
    const deps = dependencies(() => Promise.reject(new Error('timed out')));
    const assessment = await assessPlace(deps, KURLA);
    expect(assessment.waterSearched).toBeUndefined();
    expect(assessment.evidence.some((item) => item.statement.includes('could not be read'))).toBe(true);
    // The same hour: the answer was not kept, so the map is asked again.
    await assessPlace(deps, KURLA);
    expect(deps.lookups).toBe(2);
  });

  it('never looks water up while assessing every place in a row', async () => {
    const deps = dependencies((point) => Promise.resolve(parseNearbyWater(answer, point)));
    await buildSnapshot(deps);
    expect(deps.lookups).toBe(0);
  });
});
