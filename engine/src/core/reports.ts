import type { Assessment, Evidence, Level, WaterDepth } from './types.ts';

/** A neighbour's report, placed relative to the spot being assessed. */
export interface NearbyReport {
  readonly depth: WaterDepth;
  readonly distanceMetres: number;
  readonly hoursAgo: number;
}

/**
 * Only reports this close and this recent speak for the street. Further away, or older,
 * they still show on the map but no longer change the answer.
 */
export const REPORT_REACH_METRES = 300;
export const REPORT_FRESH_HOURS = 6;

const LEVELS: readonly Level[] = ['LOW', 'WATCH', 'HIGH', 'SEVERE'];
const DEPTH_WORD: Record<WaterDepth, string> = { NONE: 'no water', ANKLE: 'ankle deep', KNEE: 'knee deep', WAIST: 'waist deep' };

function wet(report: NearbyReport): boolean {
  return report.depth !== 'NONE' && report.distanceMetres <= REPORT_REACH_METRES && report.hoursAgo <= REPORT_FRESH_HOURS;
}

/**
 * The lowest level the reports allow, whatever the forecast says. Water somebody is
 * standing in outranks rain that has not fallen yet.
 *
 * Reports are anonymous, so one person could send a false one. A single report therefore
 * raises the level to WATCH at most; it takes two that agree to reach HIGH or SEVERE. A
 * report of no water never lowers the level, because one dry doorstep says little about
 * the next street.
 */
export function reportFloor(reports: readonly NearbyReport[]): { level: Level; evidence: Evidence } | undefined {
  const relevant = reports.filter(wet);
  if (relevant.length === 0) return undefined;
  const waist = relevant.filter((report) => report.depth === 'WAIST').length;
  const kneeOrMore = relevant.filter((report) => report.depth === 'KNEE' || report.depth === 'WAIST').length;
  const level: Level = waist >= 2 ? 'SEVERE' : kneeOrMore >= 2 ? 'HIGH' : 'WATCH';
  const deepest = waist > 0 ? 'WAIST' : kneeOrMore > 0 ? 'KNEE' : 'ANKLE';
  const nearest = Math.min(...relevant.map((report) => report.distanceMetres));
  const who = relevant.length === 1 ? '1 neighbour has' : `${String(relevant.length)} neighbours have`;
  const caution = relevant.length === 1 && deepest !== 'ANKLE' ? '. One report alone raises the level to WATCH; a second would raise it further' : '';
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
