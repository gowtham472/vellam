export interface Point {
  readonly lat: number;
  readonly lon: number;
}

/** One hour of rain. `time` is local Chennai time, `YYYY-MM-DDTHH:00`, at the start of the hour. */
export interface HourlyRain {
  readonly time: string;
  readonly mm: number;
}

/** The India Meteorological Department's names for rain measured over 24 hours. */
export type RainClass = 'LIGHT' | 'MODERATE' | 'HEAVY' | 'VERY_HEAVY' | 'EXTREMELY_HEAVY';

export type Level = 'LOW' | 'WATCH' | 'HIGH' | 'SEVERE';

/** Where a fact came from, so a reader can tell a measurement from a forecast from a judgement. */
export type EvidenceSource = 'FORECAST' | 'OBSERVED' | 'TERRAIN' | 'MAP' | 'HISTORY' | 'JUDGEMENT';

export interface Evidence {
  readonly source: EvidenceSource;
  readonly statement: string;
  readonly link?: string;
}

/** Ground heights around a place, in metres above sea level. */
export interface Terrain {
  readonly elevation: number;
  /** Heights sampled on a circle of about one kilometre around the place. */
  readonly surroundings: readonly number[];
}

export interface NearestWater {
  readonly name: string;
  readonly kind: string;
  readonly distanceMetres: number;
}

export type FactorId = 'FLOODED_BEFORE' | 'LOW_GROUND' | 'DEPRESSION' | 'NEAR_WATER' | 'SATURATED' | 'RAISED_GROUND';

/**
 * Something about the place, or the days before, that changes what the same rain does.
 * A positive weight makes flooding more likely; raised ground carries a negative one.
 */
export interface Factor {
  readonly id: FactorId;
  readonly title: string;
  readonly weight: -1 | 1 | 2;
  readonly evidence: Evidence;
}

export type Susceptibility = 'NONE' | 'SOME' | 'HIGH';

export interface RainWindow {
  readonly start: string;
  readonly end: string;
  readonly rainMm: number;
  readonly peakMmPerHour: number;
  /** Rain in the 24 hours ending when this window ends, which is what IMD's classes measure. */
  readonly trailing24hMm: number;
  readonly rainClass: RainClass;
  readonly level: Level;
}

export interface Assessment {
  readonly point: Point;
  /** Local time the assessment starts from. For a replay, the start of the replayed day. */
  readonly from: string;
  readonly basis: 'FORECAST' | 'REPLAY';
  readonly level: Level;
  /** The first window that reaches the overall level, when that level is above LOW. */
  readonly peak?: RainWindow;
  readonly windows: readonly RainWindow[];
  readonly susceptibility: Susceptibility;
  readonly factors: readonly Factor[];
  readonly evidence: readonly Evidence[];
  readonly terrain: Terrain;
  readonly nearestWater?: NearestWater;
  /** Metres to the nearest street residents marked as flooded in December 2015, when within a kilometre. */
  readonly floodedStreetMetres?: number;
  /** False when the place is outside the area the Chennai maps cover. */
  readonly mapped: boolean;
}

export type RainVerdict = 'MATCHED' | 'UNDER_FORECAST' | 'OVER_FORECAST';

/** One day of a place's record: what was forecast a day ahead against what fell. */
export interface ForecastCheck {
  readonly date: string;
  readonly forecastMm: number;
  readonly observedMm: number;
  readonly forecastClass: RainClass;
  readonly observedClass: RainClass;
  readonly verdict: RainVerdict;
}

export type WaterDepth = 'NONE' | 'ANKLE' | 'KNEE' | 'WAIST';

export interface WaterReport {
  readonly id: string;
  readonly point: Point;
  readonly depth: WaterDepth;
  readonly at: string;
}

/** One locality in a city-wide snapshot. */
export interface PlaceSummary {
  readonly name: string;
  readonly ta: string;
  readonly point: Point;
  readonly level: Level;
  /** The most rain in any 24 hours of the period assessed. */
  readonly worst24hMm: number;
  readonly factors: readonly string[];
}

/** Every listed locality assessed at one moment, or for one past date. */
export interface Snapshot {
  readonly basis: 'FORECAST' | 'REPLAY';
  /** Local time the assessments start from. */
  readonly from: string;
  readonly generatedAt: string;
  readonly places: readonly PlaceSummary[];
}
