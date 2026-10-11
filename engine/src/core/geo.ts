import type { Point } from './types.ts';

const METRES_PER_DEGREE = 111_320;

/**
 * Distance in metres between two points. Uses a flat approximation, which is accurate to
 * well under a metre at the few-kilometre scale this project measures.
 */
export function distanceMetres(a: Point, b: Point): number {
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const north = (a.lat - b.lat) * METRES_PER_DEGREE;
  const east = (a.lon - b.lon) * METRES_PER_DEGREE * Math.cos(meanLat);
  return Math.hypot(north, east);
}

/** `count` points evenly spaced on a circle of `radiusMetres` around `centre`. */
export function ringAround(centre: Point, radiusMetres: number, count: number): Point[] {
  const latStep = radiusMetres / METRES_PER_DEGREE;
  const lonStep = radiusMetres / (METRES_PER_DEGREE * Math.cos(centre.lat * (Math.PI / 180)));
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count;
    return { lat: centre.lat + latStep * Math.cos(angle), lon: centre.lon + lonStep * Math.sin(angle) };
  });
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle] ?? 0;
  return sorted.length % 2 === 1 ? upper : ((sorted[middle - 1] ?? upper) + upper) / 2;
}
