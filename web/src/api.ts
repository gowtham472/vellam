import type { PlaceView, TrackRecordResult } from '../../engine/src/api/service.ts';
import type { ReservoirReport } from '../../engine/src/core/reservoirs.ts';
import type { Point, Snapshot, WaterDepth, WaterReport } from '../../engine/src/core/types.ts';

const BASE = (import.meta.env['VITE_API_URL'] as string | undefined) ?? 'http://localhost:8787';

export interface Place {
  readonly name: string;
  readonly kind: 'LOCALITY' | 'CITY';
  readonly lat: number;
  readonly lon: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, init);
  } catch {
    throw new Error('Could not reach Vellam. Check your connection and try again.');
  }
  const body = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? `The request failed (${String(response.status)})`);
  return body;
}

function at(point: Point): string {
  return `lat=${String(point.lat)}&lon=${String(point.lon)}`;
}

export const api = {
  places: () => request<Place[]>('/places'),
  city: (date?: string) => request<Snapshot>(`/city${date === undefined ? '' : `?date=${date}`}`),
  assess: (point: Point, date?: string) => request<PlaceView>(`/assess?${at(point)}${date === undefined ? '' : `&date=${date}`}`),
  trackRecord: (point: Point) => request<TrackRecordResult>(`/track-record?${at(point)}`),
  report: (point: Point, depth: WaterDepth) =>
    request<WaterReport>('/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...point, depth }),
    }),
  reservoirs: (date?: string) => request<ReservoirReport>(`/reservoirs${date === undefined ? '' : `?date=${date}`}`),
  /** Subscribes to city alerts, and to one street when `street` is given. */
  subscribe: (email: string, street?: { point: Point; name: string }) =>
    request<{ message: string }>('/alerts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(street === undefined ? { email } : { email, ...street.point, name: street.name }),
    }),
};
