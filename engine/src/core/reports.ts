import type { Assessment, Evidence, Level, PhotoCheck, WaterDepth } from './types.ts';

/** A neighbour's report, placed relative to the spot being assessed. */
export interface NearbyReport {
  readonly depth: WaterDepth;
  readonly distanceMetres: number;
  readonly hoursAgo: number;
  readonly photo?: PhotoCheck;
}

/**
 * Only reports this close and this recent speak for the street. Further away, or older,
 * they still show on the map but no longer change the answer.
 */
export const REPORT_REACH_METRES = 300;
export const REPORT_FRESH_HOURS = 6;

const LEVELS: readonly Level[] = ['LOW', 'WATCH', 'HIGH', 'SEVERE'];
const DEPTH_WORD: Record<WaterDepth, string> = { NONE: 'no water', ANKLE: 'ankle deep', KNEE: 'knee deep', WAIST: 'waist deep' };

/**
 * How sure the model must be before its reading of a photo changes anything. Between the
 * two, the photo is ignored and the report counts as any other.
 */
export const PHOTO_SHOWS_WATER = 0.8;
export const PHOTO_NO_WATER = 0.2;

export function photoVerdict(waterProbability: number): PhotoCheck['verdict'] {
  return waterProbability >= PHOTO_SHOWS_WATER ? 'SHOWS_WATER' : waterProbability <= PHOTO_NO_WATER ? 'NO_WATER' : 'UNCLEAR';
}

const DEEP: readonly WaterDepth[] = ['KNEE', 'WAIST'];

/** A report of water whose own photo shows none is set aside. */
function wet(report: NearbyReport): boolean {
  return (
    report.depth !== 'NONE' &&
    report.photo?.verdict !== 'NO_WATER' &&
    report.distanceMetres <= REPORT_REACH_METRES &&
    report.hoursAgo <= REPORT_FRESH_HOURS
  );
}

/** Knee deep or more, said by the resident and seen in their photo by the model. */
function shownDeep(report: NearbyReport): boolean {
  return report.photo?.verdict === 'SHOWS_WATER' && DEEP.includes(report.depth) && DEEP.includes(report.photo.depth);
}

/**
 * The lowest level the reports allow, whatever the forecast says. Water somebody is
 * standing in outranks rain that has not fallen yet.
 *
 * Reports are anonymous, so one person could send a false one. A single report therefore
 * raises the level to WATCH at most; it takes two that agree to reach HIGH or SEVERE. A
 * report of no water never lowers the level, because one dry doorstep says little about
 * the next street.
 *
 * A photo can stand in for the second report: where the model sees knee deep water in the
 * photo of a report that says the same, that one report reaches HIGH. It never reaches
 * SEVERE alone, because a photo proves water somewhere, not that it was taken here today.
 */
export function reportFloor(reports: readonly NearbyReport[]): { level: Level; evidence: Evidence } | undefined {
  const relevant = reports.filter(wet);
  if (relevant.length === 0) return undefined;
  const waist = relevant.filter((report) => report.depth === 'WAIST').length;
  const kneeOrMore = relevant.filter((report) => report.depth === 'KNEE' || report.depth === 'WAIST').length;
  const shown = relevant.some(shownDeep);
  const level: Level = waist >= 2 ? 'SEVERE' : kneeOrMore >= 2 || shown ? 'HIGH' : 'WATCH';
  const deepest = waist > 0 ? 'WAIST' : kneeOrMore > 0 ? 'KNEE' : 'ANKLE';
  const nearest = Math.min(...relevant.map((report) => report.distanceMetres));
  const who = relevant.length === 1 ? '1 neighbour has' : `${String(relevant.length)} neighbours have`;
  const caution = shown
    ? '. A photo sent with a report was judged by a model to show water knee deep or more, which counts as a second report'
    : relevant.length === 1 && deepest !== 'ANKLE'
      ? '. One report alone raises the level to WATCH; a second, or a photo, would raise it further'
      : '';
  return {
    level,
    evidence: {
      source: 'REPORT',
      statement: `${who} reported water up to ${DEPTH_WORD[deepest]} within ${String(REPORT_REACH_METRES)} m in the last ${String(REPORT_FRESH_HOURS)} hours, the nearest ${String(Math.round(nearest))} m away${caution}`,
    },
  };
}

/** Raises an assessment to the level the reports require, and says why at the top of its evidence. */
export function applyReports(assessment: Assessment, reports: readonly NearbyReport[]): Assessment {
  const floor = reportFloor(reports);
  if (floor === undefined) return assessment;
  const raised = LEVELS.indexOf(floor.level) > LEVELS.indexOf(assessment.level);
  return {
    ...assessment,
    level: raised ? floor.level : assessment.level,
    raisedByReports: raised,
    evidence: [floor.evidence, ...assessment.evidence],
  };
}
