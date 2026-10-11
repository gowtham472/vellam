import { ringAround } from '../core/geo.ts';
import type { HourlyRain, Point, Terrain } from '../core/types.ts';
import type { CheckedHour } from '../core/verify.ts';

/**
 * Rain and terrain from Open-Meteo (https://open-meteo.com), which serves weather model
 * output and the Copernicus 90 m elevation model without an API key.
 */

const TIMEZONE = 'Asia%2FKolkata';
const SURROUNDINGS_RADIUS_METRES = 1000;
const SURROUNDINGS_SAMPLES = 8;
const PAST_DAYS = 3;

interface HourlyResponse {
  readonly hourly?: { readonly time: readonly string[] } & Record<string, readonly (number | null)[] | readonly string[]>;
  readonly error?: boolean;
  readonly reason?: string;
}

const RETRY_DELAYS_MS = [1200, 3500];

/**
 * Open-Meteo is a free service and now and then answers that it is overloaded, or times
 * out. Those clear within seconds, so the request is tried up to three times. Its
 * per-minute limit is not retried: waiting it out would take longer than a caller should.
 */
async function getJson<T>(url: string): Promise<T> {
  let failure: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      const body = (await response.json()) as T & { error?: boolean; reason?: string };
      if (response.ok && body.error !== true) return body;
      failure = new Error(`Open-Meteo refused the request: ${body.reason ?? `status ${String(response.status)}`}`);
      if (response.status === 429 || (response.status < 500 && !/overloaded/i.test(body.reason ?? ''))) break;
    } catch (error) {
      failure = error;
    }
    const delay = RETRY_DELAYS_MS[attempt];
    if (delay !== undefined) await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw failure;
}

function coordinates(point: Point): string {
  return `latitude=${point.lat.toFixed(5)}&longitude=${point.lon.toFixed(5)}`;
}

function hourlySeries(body: HourlyResponse, variable: string): (number | null)[] {
  return ((body.hourly?.[variable] as readonly (number | null)[] | undefined) ?? []).slice();
}

export interface RainSeries {
  readonly series: HourlyRain[];
  /** Index of the hour the assessment starts from. */
  readonly nowIndex: number;
}

/** Three days of rain already fallen followed by the forecast, with the current hour located. */
export async function fetchForecast(point: Point, now: Date): Promise<RainSeries> {
  const body = await getJson<HourlyResponse>(
    `https://api.open-meteo.com/v1/forecast?${coordinates(point)}&hourly=precipitation&past_days=${String(PAST_DAYS)}&forecast_days=3&timezone=${TIMEZONE}`,
  );
  const series = toSeries(body);
  const current = chennaiHour(now);
  const nowIndex = series.findIndex((hour) => hour.time === current);
  if (nowIndex < 0) throw new Error(`The forecast does not cover the current hour ${current}`);
  return { series, nowIndex };
}

/**
 * Rain from the historical record around a past date, laid out like a forecast so the same
 * assessment runs on it. The assessment starts at midnight on `date`.
 */
export async function fetchReplay(point: Point, date: string): Promise<RainSeries> {
  const start = shiftDate(date, -PAST_DAYS);
  const end = shiftDate(date, 2);
  const body = await getJson<HourlyResponse>(
    `https://archive-api.open-meteo.com/v1/archive?${coordinates(point)}&start_date=${start}&end_date=${end}&hourly=precipitation&timezone=${TIMEZONE}`,
  );
  const series = toSeries(body);
  const nowIndex = series.findIndex((hour) => hour.time === `${date}T00:00`);
  if (nowIndex < 0) throw new Error(`The historical record does not cover ${date}`);
  return { series, nowIndex };
}

/** The height of a place and of the ground a kilometre around it. */
export async function fetchTerrain(point: Point): Promise<Terrain> {
  const points = [point, ...ringAround(point, SURROUNDINGS_RADIUS_METRES, SURROUNDINGS_SAMPLES)];
  const body = await getJson<{ elevation: number[] }>(
    `https://api.open-meteo.com/v1/elevation?latitude=${points.map((p) => p.lat.toFixed(5)).join(',')}&longitude=${points.map((p) => p.lon.toFixed(5)).join(',')}`,
  );
  const [elevation, ...surroundings] = body.elevation;
  if (elevation === undefined) throw new Error('Open-Meteo returned no elevation for this place');
  return { elevation, surroundings };
}

/**
 * For each recent hour, the rain that fell and the rain that had been forecast for that
 * hour one day earlier. Open-Meteo keeps earlier model runs, which is what makes it
 * possible to check a forecast after the fact.
 */
export async function fetchForecastHistory(point: Point, days: number): Promise<CheckedHour[]> {
  const body = await getJson<HourlyResponse>(
    `https://previous-runs-api.open-meteo.com/v1/forecast?${coordinates(point)}&hourly=precipitation,precipitation_previous_day1&past_days=${String(days)}&forecast_days=1&timezone=${TIMEZONE}`,
  );
  const observed = hourlySeries(body, 'precipitation');
  const dayAhead = hourlySeries(body, 'precipitation_previous_day1');
  return (body.hourly?.time ?? []).map((time, i) => ({
    time,
    observedMm: observed[i] ?? null,
    dayAheadMm: dayAhead[i] ?? null,
  }));
}

function toSeries(body: HourlyResponse): HourlyRain[] {
  const rain = hourlySeries(body, 'precipitation');
  return (body.hourly?.time ?? []).map((time, i) => ({ time, mm: rain[i] ?? 0 }));
}

/** The current hour in Chennai as `YYYY-MM-DDTHH:00`. India has no daylight saving. */
export function chennaiHour(now: Date): string {
  return new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 13) + ':00';
}

export function shiftDate(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}
