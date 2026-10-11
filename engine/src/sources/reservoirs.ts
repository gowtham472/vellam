import { RESERVOIR_SOURCE, type ReservoirReading, type ReservoirReport } from '../core/reservoirs.ts';

/**
 * Reservoir levels from Chennai Metropolitan Water Supply and Sewerage Board, which
 * publishes one table a day and keeps the earlier ones. The page is HTML with no API, so
 * the table is read by position: name, full level, capacity, level, storage, percent,
 * inflow, outflow.
 */

const NAME = 0;
const CAPACITY = 2;
const STORAGE = 4;
const PERCENT = 5;
const INFLOW = 6;
const OUTFLOW = 7;

function text(cell: string): string {
  return cell
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function number(cell: string | undefined): number | null {
  const value = Number((cell ?? '').replace(/,/g, ''));
  return cell === undefined || cell === '' || cell === '-' || !Number.isFinite(value) ? null : value;
}

/** Reads the bulletin's date and its rows. Throws when the page no longer looks like the bulletin. */
export function parseReservoirPage(html: string): ReservoirReport {
  const date = /Lake Storage As On\s*-\s*(\d{2})\/(\d{2})\/(\d{4})/.exec(html);
  if (date === null) throw new Error('The reservoir bulletin has no date; its layout may have changed');
  const readings: ReservoirReading[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...(row[1] ?? '').matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => text(cell[1] ?? ''));
    const name = cells[NAME];
    const capacityMcft = number(cells[CAPACITY]);
    const storageMcft = number(cells[STORAGE]);
    const storagePercent = number(cells[PERCENT]);
    if (name === undefined || name === '' || name === 'TOTAL' || capacityMcft === null || storageMcft === null || storagePercent === null) {
      continue;
    }
    readings.push({
      name,
      capacityMcft,
      storageMcft,
      storagePercent,
      inflowCusecs: number(cells[INFLOW]),
      outflowCusecs: number(cells[OUTFLOW]),
    });
  }
  if (readings.length === 0) throw new Error('The reservoir bulletin has no rows; its layout may have changed');
  return { asOn: `${date[3] ?? ''}-${date[2] ?? ''}-${date[1] ?? ''}`, readings };
}

/** Today's bulletin, or the one for `date` (`YYYY-MM-DD`). */
export async function fetchReservoirs(date?: string): Promise<ReservoirReport> {
  const [year, month, day] = (date ?? '').split('-');
  const query = date === undefined ? '' : `?date=${day ?? ''}-${month ?? ''}-${year ?? ''}`;
  const response = await fetch(`${RESERVOIR_SOURCE}${query}`, {
    headers: { 'user-agent': 'Vellam flood risk (student project)' },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`The reservoir bulletin answered with status ${String(response.status)}`);
  return parseReservoirPage(await response.text());
}
