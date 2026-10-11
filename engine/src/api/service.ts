import { assess } from '../core/assess.ts';
import { distanceMetres } from '../core/geo.ts';
import { applyReports, type NearbyReport, photoVerdict } from '../core/reports.ts';
import { DOWNSTREAM, RIVER_REACH_METRES, type ReservoirReport, type RiverExposure } from '../core/reservoirs.ts';
import { GUIDANCE_SOURCE, guidanceFor, HELPLINE_SOURCE, HELPLINES, type Guidance, type Helpline } from '../core/guidance.ts';
import type { Photo, PhotoJudgement } from '../sources/clef.ts';
import type { Assessment, ForecastCheck, HourlyRain, Level, NearestWater, PhotoCheck, PlaceSummary, Point, Snapshot, Terrain, Watch, WaterDepth, WaterReport } from '../core/types.ts';
import { dailyChecks, summarize, type CheckedHour, type TrackRecord } from '../core/verify.ts';
import { isInsideMap, nearestFloodedStreet, nearestNamedWater, nearestWater, type FloodHistory, type WaterMap } from '../core/water.ts';
import floodData from '../data/chennai-flooded-2015.json' with { type: 'json' };
import placesData from '../data/chennai-places.json' with { type: 'json' };
import citiesData from '../data/india-cities.json' with { type: 'json' };
import waterData from '../data/chennai-water.json' with { type: 'json' };
import { chennaiHour, shiftDate } from '../sources/open-meteo.ts';
import { placeKey, type Repository } from './repository.ts';

const WATER_MAP = waterData as unknown as WaterMap;
const FLOOD_HISTORY = floodData as unknown as FloodHistory;
const TRACK_RECORD_DAYS = 30;
const REPORT_RADIUS_METRES = 1500;
const RESERVOIR_CACHE_HOURS = 6;
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
  /** Water within a kilometre of a place outside Chennai. Absent where no such map is configured. */
  fetchNearbyWater?(point: Point): Promise<WaterMap>;
  fetchForecastHistory(point: Point, days: number): Promise<CheckedHour[]>;
  /** Today's reservoir bulletin, or the one for a past date. */
  fetchReservoirs(date?: string): Promise<ReservoirReport>;
  /** Asks a model what a report's photo shows. Absent where no model is configured. */
  judgePhoto?(photo: Photo): Promise<PhotoJudgement>;
  /**
   * Sends a message to the subscribers of one topic: `CITY` for everyone, or a street's
   * key for the people watching that street. Absent where alerts are not configured.
   */
  publishAlert?(topic: string, subject: string, message: string): Promise<void>;
  /**
   * Subscribes an email address to city alerts and, when given, to one street. The address
   * must confirm by email. Returns false when the address is already subscribed.
   */
  subscribeToAlerts?(email: string, streetKey?: string): Promise<boolean>;
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

/**
 * The reservoir bulletin for the live forecast, or for a replay that starts on `date`.
 *
 * A replay covers 48 hours and already uses the rain recorded through them, so it reads
 * the bulletin from the morning inside that period, the day after it starts. In December
 * 2015 the record rain fell on the 1st and the 29,000 cusec release is in the bulletin of
 * the 2nd; reading the bulletin of the 1st would show a reservoir that had not opened yet.
 */
export async function reservoirsFor(deps: ServiceDependencies, date?: string): Promise<ReservoirReport> {
  const bulletin = date === undefined ? undefined : shiftDate(date, 1);
  const key = bulletin ?? 'LIVE';
  const known = await deps.repository.getReservoirs(key);
  if (known !== undefined) return known;
  const report = await deps.fetchReservoirs(bulletin);
  await deps.repository.saveReservoirs(key, report, deps.now(), date === undefined ? RESERVOIR_CACHE_HOURS : undefined);
  return report;
}

/**
 * The reservoir upstream of a place, when the place is beside a river one empties into.
 * The bulletin is read only for such places, and a bulletin that cannot be read leaves the
 * factor out instead of failing the whole assessment.
 */
async function riverExposureFor(deps: ServiceDependencies, point: Point, date?: string): Promise<RiverExposure | undefined> {
  let nearest: { link: (typeof DOWNSTREAM)[number]; distanceMetres: number } | undefined;
  for (const link of DOWNSTREAM) {
    const distanceMetres = nearestNamedWater(WATER_MAP, point, link.pattern);
    if (distanceMetres !== undefined && distanceMetres <= RIVER_REACH_METRES && (nearest === undefined || distanceMetres < nearest.distanceMetres)) {
      nearest = { link, distanceMetres };
    }
  }
  if (nearest === undefined) return undefined;
  try {
    const report = await reservoirsFor(deps, date);
    const reading = report.readings.find((candidate) => candidate.name === nearest.link.reservoir);
    if (reading === undefined) return undefined;
    return { reading, label: nearest.link.label, river: nearest.link.river, distanceMetres: nearest.distanceMetres, asOn: report.asOn };
  } catch (error) {
    console.error('Reservoir bulletin could not be read', { error });
    return undefined;
  }
}

async function terrainFor(deps: ServiceDependencies, point: Point): Promise<Terrain> {
  const known = await deps.repository.getTerrain(point);
  if (known !== undefined) return known;
  const terrain = await deps.fetchTerrain(point);
  await deps.repository.saveTerrain(point, terrain);
  return terrain;
}

/**
 * The nearest water to a place outside Chennai: null when none is within a kilometre,
 * undefined when the map could not be read. A failed lookup is not stored, so the next
 * visitor tries again. Many places assessed in a row pass `lookUp` as false and use only
 * what earlier visitors' lookups left behind, because one lookup can take five seconds.
 */
async function waterOutsideChennai(deps: ServiceDependencies, point: Point, lookUp: boolean): Promise<NearestWater | null | undefined> {
  const known = await deps.repository.getNearbyWater(point);
  if (known !== undefined || !lookUp || deps.fetchNearbyWater === undefined) return known;
  try {
    const nearest = nearestWater(await deps.fetchNearbyWater(point), point) ?? null;
    await deps.repository.saveNearbyWater(point, nearest);
    return nearest;
  } catch (error) {
    console.error('Water near a place could not be read', { error });
    return undefined;
  }
}

/**
 * Assesses a place from the live forecast, or from the historical record when `date` is
 * given. Live assessments are reused within the hour, because the forecast they rest on
 * does not change more often than that.
 */
export async function assessPlace(deps: ServiceDependencies, point: Point, date?: string, lookUpWater = true): Promise<Assessment> {
  const now = deps.now();
  const hour = chennaiHour(now);
  if (date === undefined) {
    const cached = await deps.repository.getAssessment(point, hour);
    if (cached !== undefined) return cached;
  }
  const mapped = isInsideMap(WATER_MAP, point);
  const [rain, terrain, riverExposure, searched] = await Promise.all([
    date === undefined ? deps.fetchForecast(point, now) : deps.fetchReplay(point, date),
    terrainFor(deps, point),
    mapped ? riverExposureFor(deps, point, date) : Promise.resolve(undefined),
    mapped ? Promise.resolve(undefined) : waterOutsideChennai(deps, point, lookUpWater),
  ]);
  const water = mapped ? nearestWater(WATER_MAP, point) : (searched ?? undefined);
  const floodedStreetMetres = mapped ? nearestFloodedStreet(FLOOD_HISTORY, point) : undefined;
  const assessment = assess({
    point,
    series: rain.series,
    nowIndex: rain.nowIndex,
    basis: date === undefined ? 'FORECAST' : 'REPLAY',
    terrain,
    mapped,
    ...(searched === undefined ? {} : { waterSearched: true }),
    ...(water === undefined ? {} : { nearestWater: water }),
    ...(floodedStreetMetres === undefined ? {} : { floodedStreetMetres }),
    ...(riverExposure === undefined ? {} : { riverExposure }),
  });
  // An answer missing its water because the map was slow is not kept for the hour, so the
  // next request asks the map again.
  const waterMissed = !mapped && lookUpWater && searched === undefined && deps.fetchNearbyWater !== undefined;
  if (date === undefined && !waterMissed) await deps.repository.saveAssessment(point, hour, assessment, now);
  return assessment;
}

export interface PlaceView {
  readonly assessment: Assessment;
  readonly guidance: Guidance;
  readonly reports: readonly WaterReport[];
  readonly sources: { readonly guidance: string; readonly helplines: string };
  readonly helplines: readonly Helpline[];
}

/** Everything the dashboard shows for one place. */
export async function viewPlace(deps: ServiceDependencies, point: Point, date?: string): Promise<PlaceView> {
  const [base, reports] = await Promise.all([
    assessPlace(deps, point, date),
    date === undefined ? reportsAround(deps, point) : Promise.resolve([]),
  ]);
  // Reports are applied on every view, after the hourly cache, so a report shows in the
  // answer the moment it is sent.
  const now = deps.now().getTime();
  const nearby: NearbyReport[] = reports.map((report) => ({
    depth: report.depth,
    distanceMetres: distanceMetres(point, report.point),
    hoursAgo: (now - Date.parse(report.at)) / 3_600_000,
    ...(report.photo === undefined ? {} : { photo: report.photo }),
  }));
  const assessment = applyReports(base, nearby);
  return {
    assessment,
    guidance: guidanceFor(assessment.level),
    reports,
    sources: { guidance: GUIDANCE_SOURCE, helplines: HELPLINE_SOURCE },
    helplines: HELPLINES.filter((line) => line.reach === 'INDIA' || assessment.mapped),
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
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** About 1.5 MB of image once decoded. The page shrinks a photo well below this before sending. */
const MAX_PHOTO_BASE64 = 2_000_000;

/** Reads an optional photo sent as a data URL, the form a browser produces. */
function readPhoto(value: unknown): Photo | undefined {
  if (value === undefined || value === null) return undefined;
  const match = typeof value === 'string' ? /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value) : null;
  const contentType = PHOTO_TYPES.find((type) => type === match?.[1]);
  const base64 = match?.[2];
  if (contentType === undefined || base64 === undefined) throw new HttpError(400, 'photo must be a JPEG, PNG or WebP image sent as a data URL');
  if (base64.length > MAX_PHOTO_BASE64) throw new HttpError(413, 'The photo is too large. Send one under 1.5 MB');
  return { contentType, base64 };
}

/**
 * A report is worth keeping even when its photo cannot be checked, so a failure here leaves
 * the report without a verdict and does not fail the request.
 */
async function checkPhoto(deps: ServiceDependencies, photo: Photo): Promise<PhotoCheck | undefined> {
  if (deps.judgePhoto === undefined) return undefined;
  try {
    const judgement = await deps.judgePhoto(photo);
    return { verdict: photoVerdict(judgement.waterProbability), waterProbability: judgement.waterProbability, depth: judgement.depth };
  } catch (error) {
    console.error('A report photo could not be checked', { error });
    return undefined;
  }
}

/**
 * The photo, when one is sent, is passed to the model and then dropped. Only the verdict is
 * stored with the report.
 */
export async function createReport(deps: ServiceDependencies, body: unknown): Promise<WaterReport> {
  if (typeof body !== 'object' || body === null) throw new HttpError(400, 'Send a JSON object with lat, lon and depth');
  const fields = body as Record<string, unknown>;
  const point = readPoint(fields);
  const depth = fields['depth'];
  if (typeof depth !== 'string' || !DEPTHS.includes(depth as WaterDepth)) {
    throw new HttpError(400, `depth must be one of ${DEPTHS.join(', ')}`);
  }
  const photo = readPhoto(fields['photo']);
  const now = deps.now();
  const check = photo === undefined ? undefined : await checkPhoto(deps, photo);
  const report: WaterReport = { id: deps.newId(), point, depth: depth as WaterDepth, at: now.toISOString(), ...(check === undefined ? {} : { photo: check }) };
  await deps.repository.saveReport(report, now);
  return report;
}

interface ListedPlace {
  readonly name: string;
  readonly kind: PlaceSummary['kind'];
  readonly lat: number;
  readonly lon: number;
}

const LOCALITIES: readonly ListedPlace[] = placesData.places.map((place) => ({ ...place, kind: 'LOCALITY' }));
const CITIES: readonly ListedPlace[] = citiesData.places.map((place) => ({ ...place, kind: 'CITY' }));

export function listPlaces(): readonly ListedPlace[] {
  return [...LOCALITIES, ...CITIES];
}

const LIVE_SNAPSHOT = 'LIVE';
const CITY_TOPIC = 'CITY';
const MAX_WATCHES = 100;
const ALERT_LEVELS: readonly Level[] = ['HIGH', 'SEVERE'];

function summarizePlace(place: ListedPlace, assessment: Assessment): PlaceSummary {
  return {
    name: place.name,
    kind: place.kind,
    point: { lat: place.lat, lon: place.lon },
    level: assessment.level,
    worst24hMm: Math.max(0, ...assessment.windows.map((window) => window.trailing24hMm)),
    factors: assessment.factors.map((factor) => factor.title),
    timeline: assessment.windows.map((window) => window.level),
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
  let windowStarts: string[] = [];
  // A place that fails is tried once more after all the others, by which time a brief
  // outage at the source has usually passed. One that fails twice is named in `missing`
  // so that a single bad answer does not cost the whole city its map.
  // The storms replayed are Chennai's, so a replay covers its localities only.
  let pending = date === undefined ? listPlaces() : LOCALITIES;
  for (let pass = 0; pass < 2 && pending.length > 0; pass += 1) {
    const failed: ListedPlace[] = [];
    for (const place of pending) {
      try {
        const assessment = await assessPlace(deps, { lat: place.lat, lon: place.lon }, date, false);
        from = assessment.from;
        windowStarts = assessment.windows.map((window) => window.start);
        places.push(summarizePlace(place, assessment));
      } catch (error) {
        console.error('Snapshot could not assess a place', { place: place.name, pass, error });
        failed.push(place);
      }
      await deps.pause?.();
    }
    pending = failed;
  }
  if (places.length === 0) throw new Error('No locality could be assessed; the weather source is unavailable');
  places.sort((a, b) => a.name.localeCompare(b.name));
  const snapshot: Snapshot = {
    basis: date === undefined ? 'FORECAST' : 'REPLAY',
    from,
    generatedAt: deps.now().toISOString(),
    windowStarts,
    places,
    missing: pending.map((place) => place.name),
  };
  const key = date ?? LIVE_SNAPSHOT;
  const previous = date === undefined ? await deps.repository.getSnapshot(key) : undefined;
  await deps.repository.saveSnapshot(key, snapshot);

  if (date === undefined) {
    const atRisk = places.filter((place) => ALERT_LEVELS.includes(place.level));
    const wasAtRisk = previous?.places.some((place) => ALERT_LEVELS.includes(place.level)) ?? false;
    if (atRisk.length > 0 && !wasAtRisk) {
      await deps.publishAlert?.(
        CITY_TOPIC,
        `Vellam: flooding likely in ${String(atRisk.length)} place${atRisk.length === 1 ? '' : 's'}`,
        [
          'The rain forecast for the next 48 hours puts these places at HIGH or SEVERE risk:',
          '',
          ...atRisk.map((place) => `- ${place.name}: ${place.level}, up to ${String(place.worst24hMm)} mm in 24 hours`),
          '',
          'Open Vellam for your own street, the reasons, and what to do.',
        ].join('\n'),
      );
    }
    await checkWatches(deps);
  }
  return snapshot;
}

/**
 * Assesses each watched street and tells the people watching it when it first reaches HIGH
 * or SEVERE. A street that fails to assess is skipped until the next run.
 */
async function checkWatches(deps: ServiceDependencies): Promise<void> {
  for (const watch of await deps.repository.listWatches(MAX_WATCHES)) {
    try {
      const assessment = await assessPlace(deps, watch.point);
      const wasAtRisk = watch.lastLevel !== undefined && ALERT_LEVELS.includes(watch.lastLevel);
      if (ALERT_LEVELS.includes(assessment.level) && !wasAtRisk) {
        const headline = guidanceFor(assessment.level);
        await deps.publishAlert?.(
          watch.key,
          `Vellam: ${assessment.level} flood risk at ${watch.name}`,
          [
            `${headline.headline}: ${watch.name}.`,
            '',
            ...assessment.evidence.map((item) => `- ${item.statement}`),
            '',
            'What to do:',
            ...headline.actions.map((action) => `- ${action}`),
          ].join('\n'),
        );
      }
      if (assessment.level !== watch.lastLevel) await deps.repository.saveWatch({ ...watch, lastLevel: assessment.level });
    } catch (error) {
      console.error('Watched street could not be assessed', { street: watch.key, error });
    }
    await deps.pause?.();
  }
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
  const fields = body as Record<string, unknown>;
  // A street is optional: without one the address hears about the city as a whole.
  const street = fields['lat'] === undefined ? undefined : readPoint(fields);
  const name = typeof fields['name'] === 'string' && fields['name'].trim() !== '' ? fields['name'].trim().slice(0, 80) : 'your street';
  const key = street === undefined ? undefined : placeKey(street);
  const added = await deps.subscribeToAlerts(email, key);
  if (!added) {
    throw new HttpError(409, 'This address is already subscribed. To watch a different street, unsubscribe with the link in any Vellam email, then subscribe again.');
  }
  // The street is stored without the address, which stays with the notification service.
  if (street !== undefined && key !== undefined) await deps.repository.saveWatch({ key, point: street, name });
  return {
    message:
      street === undefined
        ? 'Check your inbox and confirm the subscription to start receiving alerts'
        : `Check your inbox and confirm. You will hear when ${name} reaches high risk, and when risk appears in the places Vellam watches`,
  };
}
