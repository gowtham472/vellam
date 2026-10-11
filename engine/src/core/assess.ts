import { median } from './geo.ts';
import { classifyDailyRain, describeRainClass, IMD_CLASSIFICATION_URL, rainBefore, roundMm } from './rain.ts';
import { reservoirFactor, reservoirFloor, type RiverExposure } from './reservoirs.ts';
import type {
  Assessment,
  Evidence,
  Factor,
  HourlyRain,
  Level,
  NearestWater,
  Point,
  RainClass,
  RainWindow,
  Susceptibility,
  Terrain,
} from './types.ts';

/**
 * The thresholds below are judgements, not published standards. They are named constants so
 * the backtest in `engine/scripts/backtest.ts` measures exactly these values, and so anyone
 * who disagrees can change one number and rerun it.
 *
 * The two flood-history distances were set by measurement: 60 m reaches 25% of random
 * points in the core city and 200 m reaches 62%, whereas the first values tried, 150 m and
 * 400 m, reached 52% and 79% and so marked most of Chennai.
 *
 * The two height differences are large on purpose. The elevation model is a 90 m grid of
 * the surface, rooftops included, so differences of a few metres in a built-up area are
 * noise; a first version using 2 m and 3 m described Velachery as raised ground.
 */
export const FLOODED_STREET_METRES = 60;
export const FLOODED_AREA_METRES = 200;
export const RAISED_GROUND_METRES = 10;
export const LOW_GROUND_METRES = 5;
export const DEPRESSION_METRES = 5;
export const NEAR_WATER_METRES = 300;
export const BESIDE_WATER_METRES = 100;
export const SATURATION_HOURS = 72;
/**
 * IMD's lower bound for very heavy rain, reused as the point where ground counts as soaked.
 * The heavy rain bound, 64.5 mm, was tried first: replaying 15 October 2024 it marked every
 * locality as soaked after one wet day and rated 47 of 65 HIGH.
 */
export const SATURATION_MM = 115.6;

const WINDOW_HOURS = 6;
const WINDOW_COUNT = 8;
const LEVELS: readonly Level[] = ['LOW', 'WATCH', 'HIGH', 'SEVERE'];

/**
 * How rain and place combine. Rows are IMD's 24 hour rain classes; columns are how
 * exposed the place is. Rain alone can raise the level, the place alone cannot: a low
 * street under a dry sky is not at risk today.
 */
const LEVEL_TABLE: Record<RainClass, Record<Susceptibility, Level>> = {
  LIGHT: { NONE: 'LOW', SOME: 'LOW', HIGH: 'LOW' },
  MODERATE: { NONE: 'LOW', SOME: 'LOW', HIGH: 'WATCH' },
  HEAVY: { NONE: 'WATCH', SOME: 'WATCH', HIGH: 'HIGH' },
  VERY_HEAVY: { NONE: 'WATCH', SOME: 'HIGH', HIGH: 'SEVERE' },
  EXTREMELY_HEAVY: { NONE: 'HIGH', SOME: 'SEVERE', HIGH: 'SEVERE' },
};

export function levelFor(rainClass: RainClass, susceptibility: Susceptibility): Level {
  return LEVEL_TABLE[rainClass][susceptibility];
}

export interface AssessmentInput {
  readonly point: Point;
  /** Hourly rain covering at least the 72 hours before `nowIndex` and the 48 hours after. */
  readonly series: readonly HourlyRain[];
  /** Index in `series` of the hour the assessment starts from. */
  readonly nowIndex: number;
  readonly basis: 'FORECAST' | 'REPLAY';
  readonly terrain: Terrain;
  /** False when the place is outside the area the Chennai maps cover. */
  readonly mapped: boolean;
  readonly nearestWater?: NearestWater;
  /** True when water near a place outside the Chennai maps was looked up in OpenStreetMap. */
  readonly waterSearched?: boolean;
  /** Metres to the nearest street marked as flooded in December 2015, when within a kilometre. */
  readonly floodedStreetMetres?: number;
  /** The reservoir upstream, when the place is beside a river one empties into. */
  readonly riverExposure?: RiverExposure;
}

export function assess(input: AssessmentInput): Assessment {
  const { point, series, nowIndex, basis, terrain, mapped, nearestWater, floodedStreetMetres } = input;
  const factors = placeFactors(terrain, nearestWater, floodedStreetMetres);
  const reservoir = reservoirFactor(input.riverExposure);
  if (reservoir !== undefined) factors.push(reservoir);
  const soaked = saturationFactor(series, nowIndex, basis);
  if (soaked !== undefined) factors.push(soaked);
  const susceptibility = susceptibilityOf(factors);

  // A heavy release holds every window at its floor: the bulletin describes the river for
  // the whole period, not one six hour stretch of it.
  const floor = reservoirFloor(input.riverExposure);
  const windows = buildWindows(series, nowIndex, susceptibility).map((window) =>
    floor !== undefined && rank(floor.level) > rank(window.level) ? { ...window, level: floor.level } : window,
  );
  const level = windows.reduce<Level>((worst, w) => (rank(w.level) > rank(worst) ? w.level : worst), 'LOW');
  const peak = level === 'LOW' ? undefined : windows.find((w) => w.level === level);
  const wettest = windows.reduce<RainWindow | undefined>(
    (best, w) => (best === undefined || w.trailing24hMm > best.trailing24hMm ? w : best),
    undefined,
  );

  const evidence: Evidence[] = [];
  if (wettest !== undefined) evidence.push(rainEvidence(wettest, basis));
  evidence.push(...factors.map((factor) => factor.evidence));
  if (!mapped) {
    evidence.push({
      source: 'MAP',
      statement:
        input.waterSearched === true
          ? 'This place is outside Chennai, where no record of past flooding is held. Water within 1 km was read from OpenStreetMap'
          : 'This place is outside Chennai, where no record of past flooding is held, and the map of water nearby could not be read, so distance to water was not assessed',
    });
  }
  const risky = factors.filter((factor) => factor.weight > 0).length;
  const rainLevel = levelFor(wettest?.rainClass ?? 'LIGHT', susceptibility);
  evidence.push(judgementEvidence(wettest?.rainClass ?? 'LIGHT', risky, rainLevel));
  if (floor !== undefined && rank(floor.level) > rank(rainLevel)) evidence.push(floor.evidence);

  return {
    point,
    from: series[nowIndex]?.time ?? '',
    basis,
    level,
    ...(peak === undefined ? {} : { peak }),
    windows,
    susceptibility,
    factors,
    evidence,
    terrain,
    ...(nearestWater === undefined ? {} : { nearestWater }),
    ...(floodedStreetMetres === undefined ? {} : { floodedStreetMetres }),
    mapped,
    ...(input.waterSearched === true ? { waterSearched: true } : {}),
  };
}

function rank(level: Level): number {
  return LEVELS.indexOf(level);
}

export const FLOOD_HISTORY_URL = 'https://github.com/osm-in/flood-map';

function placeFactors(terrain: Terrain, nearestWater: NearestWater | undefined, floodedStreetMetres: number | undefined): Factor[] {
  const factors: Factor[] = [];
  if (floodedStreetMetres !== undefined && floodedStreetMetres <= FLOODED_AREA_METRES) {
    const onStreet = floodedStreetMetres <= FLOODED_STREET_METRES;
    factors.push({
      id: 'FLOODED_BEFORE',
      title: onStreet ? 'This street flooded in 2015' : 'Streets nearby flooded in 2015',
      weight: onStreet ? 2 : 1,
      evidence: {
        source: 'HISTORY',
        statement: `Residents marked a street ${String(floodedStreetMetres)} m from here as flooded during the December 2015 floods`,
        link: FLOOD_HISTORY_URL,
      },
    });
  }
  if (terrain.elevation <= LOW_GROUND_METRES) {
    factors.push({
      id: 'LOW_GROUND',
      title: 'Low ground',
      weight: 1,
      evidence: {
        source: 'TERRAIN',
        statement: `The ground here is about ${String(terrain.elevation)} m above sea level, and water drains slowly from ground this close to sea level`,
      },
    });
  }
  if (terrain.surroundings.length > 0) {
    const around = median(terrain.surroundings);
    const drop = around - terrain.elevation;
    if (-drop >= RAISED_GROUND_METRES) {
      factors.push({
        id: 'RAISED_GROUND',
        title: 'On raised ground',
        weight: -1,
        evidence: {
          source: 'TERRAIN',
          statement: `This spot is ${String(-drop)} m above the ground within a kilometre of it, so water runs away from it`,
        },
      });
    }
    if (drop >= DEPRESSION_METRES) {
      factors.push({
        id: 'DEPRESSION',
        title: 'Lower than its surroundings',
        weight: 1,
        evidence: {
          source: 'TERRAIN',
          statement: `Ground within a kilometre is typically ${String(around)} m high and this spot is ${String(drop)} m lower, so water runs towards it`,
        },
      });
    }
  }
  if (nearestWater !== undefined && nearestWater.distanceMetres <= NEAR_WATER_METRES) {
    const label = nearestWater.name === '' ? `A ${nearestWater.kind}` : `${nearestWater.name} (${nearestWater.kind})`;
    factors.push({
      id: 'NEAR_WATER',
      title: 'Close to a water body',
      weight: nearestWater.distanceMetres <= BESIDE_WATER_METRES ? 2 : 1,
      evidence: {
        source: 'MAP',
        statement: `${label} is ${String(nearestWater.distanceMetres)} m away and can overflow or back up into nearby streets`,
        link: 'https://www.openstreetmap.org/copyright',
      },
    });
  }
  return factors;
}

function saturationFactor(series: readonly HourlyRain[], nowIndex: number, basis: 'FORECAST' | 'REPLAY'): Factor | undefined {
  const recent = rainBefore(series, nowIndex, SATURATION_HOURS);
  if (recent < SATURATION_MM) return undefined;
  return {
    id: 'SATURATED',
    title: 'Ground already soaked',
    weight: 1,
    evidence: {
      source: 'OBSERVED',
      statement: `${String(recent)} mm fell in the ${String(SATURATION_HOURS)} hours before ${basis === 'REPLAY' ? 'this point' : 'now'}, so the ground and drains have little room left`,
    },
  };
}

function susceptibilityOf(factors: readonly Factor[]): Susceptibility {
  const weight = factors.reduce<number>((sum, factor) => sum + factor.weight, 0);
  if (weight >= 2) return 'HIGH';
  return weight === 1 ? 'SOME' : 'NONE';
}

function buildWindows(series: readonly HourlyRain[], nowIndex: number, susceptibility: Susceptibility): RainWindow[] {
  const windows: RainWindow[] = [];
  for (let n = 0; n < WINDOW_COUNT; n += 1) {
    const startIndex = nowIndex + n * WINDOW_HOURS;
    const hours = series.slice(startIndex, startIndex + WINDOW_HOURS);
    const first = hours[0];
    if (first === undefined || hours.length < WINDOW_HOURS) break;
    const trailing24hMm = rainBefore(series, startIndex + WINDOW_HOURS, 24);
    const rainClass = classifyDailyRain(trailing24hMm);
    windows.push({
      start: first.time,
      end: addHours(first.time, WINDOW_HOURS),
      rainMm: roundMm(hours.reduce((sum, hour) => sum + hour.mm, 0)),
      peakMmPerHour: roundMm(Math.max(...hours.map((hour) => hour.mm))),
      trailing24hMm,
      rainClass,
      level: levelFor(rainClass, susceptibility),
    });
  }
  return windows;
}

function rainEvidence(wettest: RainWindow, basis: 'FORECAST' | 'REPLAY'): Evidence {
  const verb = basis === 'FORECAST' ? 'The forecast gives' : 'The record shows';
  return {
    source: basis === 'FORECAST' ? 'FORECAST' : 'OBSERVED',
    statement: `${verb} ${String(wettest.trailing24hMm)} mm in the 24 hours to ${formatHour(wettest.end)}. The India Meteorological Department calls that ${describeRainClass(wettest.rainClass)}`,
    link: IMD_CLASSIFICATION_URL,
  };
}

function judgementEvidence(rainClass: RainClass, factorCount: number, level: Level): Evidence {
  const place =
    factorCount === 0
      ? 'a place with none of the risk factors Vellam checks'
      : `a place with ${String(factorCount)} risk factor${factorCount === 1 ? '' : 's'}`;
  return {
    source: 'JUDGEMENT',
    statement: `Vellam rates ${describeRainClass(rainClass).split(' (')[0] ?? ''} on ${place} as ${level}. This rating is a rule of thumb, not a model of how water flows`,
  };
}

/** Adds whole hours to a local `YYYY-MM-DDTHH:00` time without involving time zones. */
export function addHours(time: string, hours: number): string {
  const [date = '', clock = '00:00'] = time.split('T');
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day, Number(clock.slice(0, 2)) + hours));
  return moved.toISOString().slice(0, 13) + ':00';
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** `2026-10-12T18:00` as `Mon 12 Oct, 6 PM`. */
export function formatHour(time: string): string {
  const [date = '', clock = '00:00'] = time.split('T');
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const hour = Number(clock.slice(0, 2));
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] ?? '';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${weekday} ${String(day)} ${MONTHS[month - 1] ?? ''}, ${String(twelve)} ${hour < 12 ? 'AM' : 'PM'}`;
}
