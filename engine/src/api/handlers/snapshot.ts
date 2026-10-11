import { awsDependencies } from '../dependencies.ts';
import { buildSnapshot, readDate } from '../service.ts';

/**
 * Open-Meteo counts requests per minute. A snapshot asks about every locality in a row, so
 * it waits between them; the first run also fetches each place's terrain, which later runs
 * read from DynamoDB.
 */
const deps = awsDependencies({ pauseMs: 1200 });

/**
 * Invoked by EventBridge Scheduler with no input to refresh the live snapshot, or by hand
 * with `{ "date": "2023-12-04" }` to store the replay of a past storm.
 */
export async function handler(event: { date?: string } | undefined): Promise<{ basis: string; from: string; places: number; atRisk: number }> {
  const snapshot = await buildSnapshot(deps, readDate(event?.date));
  return {
    basis: snapshot.basis,
    from: snapshot.from,
    places: snapshot.places.length,
    atRisk: snapshot.places.filter((place) => place.level === 'HIGH' || place.level === 'SEVERE').length,
  };
}
