import type { Point } from '../core/types.ts';
import type { WaterMap } from '../core/water.ts';

/**
 * Water near a place, read from OpenStreetMap through the Overpass API. Chennai has a
 * water map bundled with the engine; this is how every other place in India gets one, a
 * kilometre at a time, when somebody asks about it.
 *
 * The public Overpass servers queue requests: the same query has answered in under two
 * seconds and, minutes later, not at all. The request is given five seconds and then
 * abandoned, so a slow map never costs a visitor the forecast.
 */

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
export const NEARBY_WATER_METRES = 1000;
const TIMEOUT_MS = 5_000;
const WATERWAYS = 'river|stream|canal|drain';

interface OverpassElement {
  readonly tags?: Readonly<Record<string, string>>;
  readonly geometry?: readonly ({ readonly lat: number; readonly lon: number } | null)[];
  readonly members?: readonly { readonly geometry?: readonly { readonly lat: number; readonly lon: number }[] }[];
}

function query(point: Point): string {
  const around = `(around:${String(NEARBY_WATER_METRES)},${String(point.lat)},${String(point.lon)})`;
  return `[out:json][timeout:5];(way["natural"="water"]${around};way["waterway"~"^(${WATERWAYS})$"]${around};relation["natural"="water"]${around};);out tags geom;`;
}

/** Turns an Overpass answer into the same shape as the bundled Chennai water map. */
export function parseNearbyWater(body: unknown, point: Point): WaterMap {
  const elements = (body as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) throw new Error('The water map answer has no elements; its format may have changed');
  const names: string[] = [];
  const kinds: string[] = [];
  const points: [number, number, number, number][] = [];
  const indexIn = (list: string[], value: string): number => {
    const found = list.indexOf(value);
    return found === -1 ? list.push(value) - 1 : found;
  };
  for (const element of elements as OverpassElement[]) {
    const tags = element.tags ?? {};
    const name = indexIn(names, tags['name:en'] ?? tags['name'] ?? '');
    const kind = indexIn(kinds, tags['waterway'] ?? tags['water'] ?? 'water body');
    const outline = [...(element.geometry ?? []), ...(element.members ?? []).flatMap((member) => member.geometry ?? [])];
    for (const node of outline) if (node !== null) points.push([node.lat, node.lon, name, kind]);
  }
  return { bounds: [point.lat, point.lon, point.lat, point.lon], names, kinds, points };
}

export async function fetchNearbyWater(point: Point): Promise<WaterMap> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'vellam-flood-check (github.com/gowtham472/vellam)' },
    body: `data=${encodeURIComponent(query(point))}`,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`The water map request failed (${String(response.status)})`);
  return parseNearbyWater(await response.json(), point);
}
