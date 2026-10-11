import { distanceMetres } from './geo.ts';
import type { NearestWater, Point } from './types.ts';

/**
 * Lakes, wetlands, rivers and canals as points sampled along each feature, produced by
 * `scripts/fetch-water.py` from OpenStreetMap. Each point is
 * `[lat, lon, index into names, index into kinds]`.
 */
export interface WaterMap {
  readonly bounds: readonly [south: number, west: number, north: number, east: number];
  readonly names: readonly string[];
  readonly kinds: readonly string[];
  readonly points: readonly (readonly [number, number, number, number])[];
}

export function isInsideMap(map: { readonly bounds: readonly [number, number, number, number] }, point: Point): boolean {
  const [south, west, north, east] = map.bounds;
  return point.lat >= south && point.lat <= north && point.lon >= west && point.lon <= east;
}

/** The closest mapped water to a place, or undefined when the map has no water at all. */
export function nearestWater(map: WaterMap, point: Point): NearestWater | undefined {
  let best: NearestWater | undefined;
  for (const [lat, lon, nameIndex, kindIndex] of map.points) {
    // A cheap latitude check skips points more than about five kilometres away.
    if (Math.abs(lat - point.lat) > 0.045) continue;
    const distance = distanceMetres(point, { lat, lon });
    if (best === undefined || distance < best.distanceMetres) {
      best = {
        name: map.names[nameIndex] ?? '',
        kind: map.kinds[kindIndex] ?? 'water',
        distanceMetres: Math.round(distance),
      };
    }
  }
  return best;
}

/** Streets residents marked as flooded in December 2015, as `[lat, lon]` points along each street. */
export interface FloodHistory {
  readonly bounds: readonly [south: number, west: number, north: number, east: number];
  readonly points: readonly (readonly [number, number])[];
}

const HISTORY_SEARCH_METRES = 1000;

/** Metres to the nearest street marked as flooded, or undefined when none lies within a kilometre. */
export function nearestFloodedStreet(history: FloodHistory, point: Point): number | undefined {
  let best: number | undefined;
  for (const [lat, lon] of history.points) {
    if (Math.abs(lat - point.lat) > 0.01) continue;
    const distance = distanceMetres(point, { lat, lon });
    if (distance <= HISTORY_SEARCH_METRES && (best === undefined || distance < best)) best = distance;
  }
  return best === undefined ? undefined : Math.round(best);
}

/** Metres to the nearest mapped water whose name matches, or undefined when none is within five kilometres. */
export function nearestNamedWater(map: WaterMap, point: Point, pattern: RegExp): number | undefined {
  const matching = new Set(map.names.flatMap((name, index) => (pattern.test(name) ? [index] : [])));
  let best: number | undefined;
  for (const [lat, lon, nameIndex] of map.points) {
    if (!matching.has(nameIndex) || Math.abs(lat - point.lat) > 0.045) continue;
    const distance = distanceMetres(point, { lat, lon });
    if (best === undefined || distance < best) best = distance;
  }
  return best === undefined ? undefined : Math.round(best);
}
