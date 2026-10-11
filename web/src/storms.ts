/** Past storms a visitor can replay. Each date is the day the heaviest rain fell. */
export const STORMS = [
  {
    date: '2023-12-04',
    name: 'Cyclone Michaung',
    note: '4 December 2023',
    summary: 'More than 40 cm in two days. Most of the city went under.',
  },
  {
    date: '2024-11-30',
    name: 'Cyclone Fengal',
    note: '30 November 2024',
    summary: 'Very heavy rain as the cyclone crossed the coast south of Chennai.',
  },
  {
    date: '2024-10-15',
    name: 'October heavy rain',
    note: '15 October 2024',
    summary: 'An ordinary heavy monsoon day: the test of whether Vellam over-warns.',
  },
  {
    date: '2015-12-01',
    name: 'The 2015 flood',
    note: '1 December 2015',
    summary:
      'Record rain, then Chembarambakkam released 29,000 cusecs into the Adyar. The streets marked in 2015 come from this flood, so this replay cannot test that record.',
  },
  {
    date: '2021-11-11',
    name: 'November deluge',
    note: '11 November 2021',
    summary: 'A depression brought extremely heavy rain after a week of wet days.',
  },
] as const;

export function stormName(date: string): string {
  return STORMS.find((storm) => storm.date === date)?.name ?? date;
}
