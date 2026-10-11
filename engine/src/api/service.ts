import { assess } from '../core/assess.ts';
import { distanceMetres } from '../core/geo.ts';
import { GUIDANCE_SOURCE, guidanceFor, HELPLINE_SOURCE, HELPLINES, type Guidance, type Language } from '../core/guidance.ts';
import type { Assessment, ForecastCheck, HourlyRain, Level, PlaceSummary, Point, Snapshot, Terrain, WaterDepth, WaterReport } from '../core/types.ts';
import { dailyChecks, summarize, type CheckedHour, type TrackRecord } from '../core/verify.ts';
import { isInsideMap, nearestFloodedStreet, nearestWater, type FloodHistory, type WaterMap } from '../core/water.ts';
import floodData from '../data/chennai-flooded-2015.json' with { type: 'json' };
import placesData from '../data/chennai-places.json' with { type: 'json' };
import waterData from '../data/chennai-water.json' with { type: 'json' };
import { chennaiHour } from '../sources/open-meteo.ts';
import type { Repository } from './repository.ts';

const WATER_MAP = waterData as unknown as WaterMap;
const FLOOD_HISTORY = floodData as unknown as FloodHistory;
const TRACK_RECORD_DAYS = 30;
const REPORT_RADIUS_METRES = 1500;
const DEPTHS: readonly WaterDepth[] = ['NONE', 'ANKLE', 'KNEE', 'WAIST'];

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface RainSeries {
  readonly series: HourlyRain[];
  readonly nowIndex: number;
}

/** Everything the service reaches outside itself, so tests can supply fixed answers. */
export interface ServiceDependencies {
  readonly repository: Repository;
  fetchForecast(point: Point, now: Date): Promise<RainSeries>;
  fetchReplay(point: Point, date: string): Promise<RainSeries>;
  fetchTerrain(point: Point): Promise<Terrain>;
  fetchForecastHistory(point: Point, days: number): Promise<CheckedHour[]>;
  /** Sends a message to everyone subscribed to city alerts. Absent where alerts are not configured. */
  publishAlert?(subject: string, message: string): Promise<void>;
  /** Subscribes an email address to city alerts; the address must confirm by email. */
  subscribeToAlerts?(email: string): Promise<void>;
  /** Waits between weather requests when many places are assessed in a row. */
  pause?(): Promise<void>;
  now(): Date;
  newId(): string;
}

/** Reads `lat` and `lon` and rejects anything that is not a place in India. */
export function readPoint(source: Record<string, unknown>): Point {
  const lat = Number(source['lat']);
  const lon = Number(source['lon']);
  if (source['lat'] === undefined || source['lon'] === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new HttpError(400, 'lat and lon are required numbers');
  }
  if (lat < 6 || lat > 37.5 || lon < 68 || lon > 97.5) {
    throw new HttpError(400, 'Vellam covers places in India only');
  }
  return { lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5 };
}

export function readDate(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, 'date must look like 2023-12-04');
  }
  return value;
}

async function terrainFor(deps: ServiceDependencies, point: Point): Promise<Terrain> {
  const known = await deps.repository.getTerrain(point);
  if (known !== undefined) return known;
  const terrain = await deps.fetchTerrain(point);
  await deps.repository.saveTerrain(point, terrain);
  return terrain;
}

/**
 * Assesses a place from the live forecast, or from the historical record when `date` is
 * given. Live assessments are reused within the hour, because the forecast they rest on
 * does not change more often than that.
 */
export async function assessPlace(deps: ServiceDependencies, point: Point, date?: string): Promise<Assessment> {
  const now = deps.now();
  const hour = chennaiHour(now);
  if (date === undefined) {
    const cached = await deps.repository.getAssessment(point, hour);
    if (cached !== undefined) return cached;
  }
  const [rain, terrain] = await Promise.all([
    date === undefined ? deps.fetchForecast(point, now) : deps.fetchReplay(point, date),
    terrainFor(deps, point),
  ]);
  const mapped = isInsideMap(WATER_MAP, point);
  const water = mapped ? nearestWater(WATER_MAP, point) : undefined;
  const floodedStreetMetres = mapped ? nearestFloodedStreet(FLOOD_HISTORY, point) : undefined;
  const assessment = assess({
    point,
    series: rain.series,
    nowIndex: rain.nowIndex,
    basis: date === undefined ? 'FORECAST' : 'REPLAY',
    terrain,
    mapped,
    ...(water === undefined ? {} : { nearestWater: water }),
    ...(floodedStreetMetres === undefined ? {} : { floodedStreetMetres }),
  });
  if (date === undefined) await deps.repository.saveAssessment(point, hour, assessment, now);
  return assessment;
}

export interface PlaceView {
  readonly assessment: Assessment;
  readonly guidance: Record<Language, Guidance>;
  readonly reports: readonly WaterReport[];
  readonly sources: { readonly guidance: string; readonly helplines: string };
  readonly helplines: typeof HELPLINES;
}

/** Everything the dashboard shows for one place. */
export async function viewPlace(deps: ServiceDependencies, point: Point, date?: string): Promise<PlaceView> {
  const [assessment, reports] = await Promise.all([
    assessPlace(deps, point, date),
    date === undefined ? reportsAround(deps, point) : Promise.resolve([]),
  ]);
  return {
    assessment,
    guidance: { en: guidanceFor(assessment.level, 'en'), ta: guidanceFor(assessment.level, 'ta') },
    reports,
    sources: { guidance: GUIDANCE_SOURCE, helplines: HELPLINE_SOURCE },
    helplines: HELPLINES,
  };
}

export interface TrackRecordResult {
  readonly point: Point;
  readonly record: TrackRecord;
  readonly checks: readonly ForecastCheck[];
}

/** How the day-ahead rain forecast for this place compared with what fell, day by day. */
export async function trackRecord(deps: ServiceDependencies, point: Point): Promise<TrackRecordResult> {
  const checks = dailyChecks(await deps.fetchForecastHistory(point, TRACK_RECORD_DAYS));
  return { point, record: summarize(checks), checks };
}

export async function reportsAround(deps: ServiceDependencies, point: Point): Promise<WaterReport[]> {
  const nearby = await deps.repository.reportsNear(point, deps.now());
  return nearby
    .filter((report) => distanceMetres(point, report.point) <= REPORT_RADIUS_METRES)
    .sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Stores what a resident sees outside. A report carries a place, a depth and a time, and
 * nothing that identifies the person, so there is no free text to moderate or to leak.
 */
export async function createReport(deps: ServiceDependencies, body: unknown): Promise<WaterReport> {
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Send a JSON object with lat, lon and depth');
  const fields = body as Record<string, unknown>;
  const point = readPoint(fields);
  const depth = fields['depth'];
  if (typeof depth !== 'string' || !DEPTHS.includes(depth as WaterDepth)) {
    throw new HttpError(400, `depth must be one of ${DEPTHS.join(', ')}`);
  }
  const now = deps.now();
  const report: WaterReport = { id: deps.newId(), point, depth: depth as WaterDepth, at: now.toISOString() };
  await deps.repository.saveReport(report, now);
  return report;
}

export function listPlaces(): typeof placesData.places {
  return placesData.places;
}

const LIVE_SNAPSHOT = 'LIVE';
const ALERT_LEVELS: readonly Level[] = ['HIGH', 'SEVERE'];

function summarizePlace(place: (typeof placesData.places)[number], assessment: Assessment): PlaceSummary {
  return {
    name: place.name,
    ta: place.ta,
    point: { lat: place.lat, lon: place.lon },
    level: assessment.level,
    worst24hMm: Math.max(0, ...assessment.windows.map((window) => window.trailing24hMm)),
    factors: assessment.factors.map((factor) => factor.title),
  };
}

/**
 * Assesses every listed locality and stores the result, so the map opens without the
 * browser asking for sixty places one by one. Run on a schedule for the live forecast and
 * once per past storm for a replay.
 *
 * An alert goes out only when a live snapshot has places at HIGH or above and the one
 * before it had none, so subscribers hear when a threat appears, not every three hours
 * while it lasts.
 */
export async function buildSnapshot(deps: ServiceDependencies, date?: string): Promise<Snapshot> {
  const places: PlaceSummary[] = [];
  let from = '';
  for (const place of placesData.places) {
    const assessment = await assessPlace(deps, { lat: place.lat, lon: place.lon }, date);
    from = assessment.from;
    places.push(summarizePlace(place, assessment));
    await deps.pause?.();
  }
  const snapshot: Snapshot = {
    basis: date === undefined ? 'FORECAST' : 'REPLAY',
    from,
    generatedAt: deps.now().toISOString(),
    places,
  };
  const key = date ?? LIVE_SNAPSHOT;
  const previous = date === undefined ? await deps.repository.getSnapshot(key) : undefined;
  await deps.repository.saveSnapshot(key, snapshot);

  if (date === undefined) {
    const atRisk = places.filter((place) => ALERT_LEVELS.includes(place.level));
    const wasAtRisk = previous?.places.some((place) => ALERT_LEVELS.includes(place.level)) ?? false;
    if (atRisk.length > 0 && !wasAtRisk) {
      await deps.publishAlert?.(
        `Vellam: flooding likely in ${String(atRisk.length)} Chennai localit${atRisk.length === 1 ? 'y' : 'ies'}`,
        [
          'The rain forecast for the next 48 hours puts these localities at HIGH or SEVERE risk:',
          '',
          ...atRisk.map((place) => `- ${place.name}: ${place.level}, up to ${String(place.worst24hMm)} mm in 24 hours`),
          '',
          'Open Vellam for your own street, the reasons, and what to do.',
        ].join('\n'),
      );
    }
  }
  return snapshot;
}

export async function citySnapshot(deps: ServiceDependencies, date?: string): Promise<Snapshot> {
  const snapshot = await deps.repository.getSnapshot(date ?? LIVE_SNAPSHOT);
  if (snapshot === undefined) {
    throw new HttpError(404, date === undefined ? 'The city snapshot has not been built yet' : `No replay is stored for ${date}`);
  }
  return snapshot;
}

export async function subscribe(deps: ServiceDependencies, body: unknown): Promise<{ message: string }> {
  const email = typeof body === 'object' && body !== null ? (body as Record<string, unknown>)['email'] : undefined;
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new HttpError(400, 'Enter a valid email address');
  }
  if (deps.subscribeToAlerts === undefined) throw new HttpError(503, 'Alerts are not set up on this deployment');
  await deps.subscribeToAlerts(email);
  return { message: 'Check your inbox and confirm the subscription to start receiving alerts' };
}
