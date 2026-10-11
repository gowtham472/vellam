/** Past storms a visitor can replay. Each date is the day the heaviest rain fell. */
export const STORMS = [
  { date: '2023-12-04', name: 'Cyclone Michaung', note: '4 December 2023' },
  { date: '2024-11-30', name: 'Cyclone Fengal', note: '30 November 2024' },
  { date: '2024-10-15', name: 'October heavy rain', note: '15 October 2024' },
  { date: '2021-11-11', name: 'November deluge', note: '11 November 2021' },
] as const;

export function stormName(date: string): string {
  return STORMS.find((storm) => storm.date === date)?.name ?? date;
}
