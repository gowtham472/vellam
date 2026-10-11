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
export type EvidenceSource = 'FORECAST' | 'OBSERVED' | 'TERRAIN' | 'MAP' | 'HISTORY' | 'RESERVOIR' | 'REPORT' | 'JUDGEMENT';

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

export type FactorId = 'FLOODED_BEFORE' | 'RESERVOIR' | 'LOW_GROUND' | 'DEPRESSION' | 'NEAR_WATER' | 'SATURATED' | 'RAISED_GROUND';

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
  /** True when water near a place outside the Chennai maps was looked up in OpenStreetMap. */
  readonly waterSearched?: boolean;
  /** True when neighbours' reports of water, not the forecast, set the level. */
  readonly raisedByReports?: boolean;
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

/**
 * What a model made of the photo sent with a report. Only this verdict is kept; the photo
 * is read once and discarded.
 */
export interface PhotoCheck {
  readonly verdict: 'SHOWS_WATER' | 'NO_WATER' | 'UNCLEAR';
  /** The model's probability that the photo shows flood water, from 0 to 1. */
  readonly waterProbability: number;
  /** The depth the model thought most likely, which may differ from the one reported. */
  readonly depth: WaterDepth;
}

export interface WaterReport {
  readonly id: string;
  readonly point: Point;
  readonly depth: WaterDepth;
  readonly at: string;
  readonly photo?: PhotoCheck;
}

/** One locality in a city-wide snapshot. */
export interface PlaceSummary {
  readonly name: string;
  /** A Chennai locality, or one of the major cities shown on the national map. */
  readonly kind: 'LOCALITY' | 'CITY';
  readonly point: Point;
  readonly level: Level;
  /** The most rain in any 24 hours of the period assessed. */
  readonly worst24hMm: number;
  readonly factors: readonly string[];
  /** The level in each six hour window, in order, so the map can be played through time. */
  readonly timeline: readonly Level[];
}

/** Every listed locality assessed at one moment, or for one past date. */
export interface Snapshot {
  readonly basis: 'FORECAST' | 'REPLAY';
  /** Local time the assessments start from. */
  readonly from: string;
  readonly generatedAt: string;
  /** When each six hour window starts, shared by every place's timeline. */
  readonly windowStarts: readonly string[];
  readonly places: readonly PlaceSummary[];
  /** Localities left out because the weather or terrain source failed twice for them. */
  readonly missing: readonly string[];
}

/** A street somebody asked to be told about. It holds a place and nothing about the person. */
export interface Watch {
  readonly key: string;
  readonly point: Point;
  readonly name: string;
  /** The level at the last check, so an alert goes out when risk appears and not while it lasts. */
  readonly lastLevel?: Level;
}
