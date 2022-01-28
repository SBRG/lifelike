export enum SortingAlgorithmId {
  frequency = 'frequency',
  sum_log_count = 'sum_log_count',
  mwu = 'mwu',
  count_per_row = 'count_per_row'
}

export interface SortingAlgorithm {
  id: SortingAlgorithmId;
  name: string;
  title?: string;
  description?: string;
  valueDescription: string;
  min?: number;
  max?: number;
  step?: number;
  default?: number;
}

const frequency = {
  id: SortingAlgorithmId.frequency,
  name: 'Frequency',
  description: `
Standard word cloud with word size determined from total word count.<br/>
<p class="text-center m-2">𝙬𝙚𝙞𝙜𝙝𝙩 = 𝙨𝙪𝙢<sub>𝙞</sub> (𝙘𝙤𝙪𝙣𝙩<sub>𝙞</sub> )</p>
    `,
  valueDescription: 'Entity Frequency',
  min: 0,
  step: 1,
  default: 1,
};

const mwu = {
  id: SortingAlgorithmId.mwu,
  name: 'Mann–Whitney U test',
  description: `
Each word are weighted according to a one-sided MWU test that assesses whether a count
for that specific term tends to be larger than a count from any other term.<br/>
<p class="text-center m-2">𝙬𝙚𝙞𝙜𝙝𝙩 = -𝙡𝙤𝙜 (𝙥 -𝙫𝙖𝙡𝙪𝙚 )</p>
    `,
  valueDescription: '-log(p-value)',
  min: 0,
  step: 0.25,
  default: 0,
};

export const fileTypeSortingAlgorithms = {
  'vnd.lifelike.filesystem/directory': {
    default: frequency,
    all: [
      frequency,
      {
        id: SortingAlgorithmId.sum_log_count,
        name: 'Log transformed frequency',
        description: `
Log transformed counts. Method emphasizes terms appearing across multiple sources
over similar counts collected from a single source.<br/>
<p class="text-center m-2">𝙬𝙚𝙞𝙜𝙝𝙩 = 𝙨𝙪𝙢<sub>𝙞</sub> (𝙡𝙤𝙜 (𝙘𝙤𝙪𝙣𝙩<sub>𝙞</sub> ))</p>
        `,
        valueDescription: 'Sum log of frequency per file',
        min: 0,
        step: 0.1,
        default: 0,
      },
      // mwu <Temporarily disabled>
    ]
  },
  'application/pdf': {
    default: frequency,
    all: [
      frequency
    ]
  },
  'vnd.lifelike.document/enrichment-table': {
    default: frequency, all: [
      frequency,
      {
        id: SortingAlgorithmId.count_per_row,
        name: 'Count per row',
        description: `Number of rows a value occurs in.`,
        valueDescription: 'Count per row',
        min: 0,
        step: 1,
        default: 1,
      },
//       {
//         ...mwu,
//         description: `
// Each word are weighted according to a one-sided MWU test that assesses whether a count
// for that specific term tends to be larger than a count from any other term.<br/>
// <p class="text-center m-2">𝙬𝙚𝙞𝙜𝙝𝙩 = -𝙡𝙤𝙜 (𝙥 -𝙫𝙖𝙡𝙪𝙚 )</p>
// Normally one would simply sum occurrences of the gene within the row, however,
// since some columns might be highly correlated (duplicated text)
// the number of maximum mentions per column is used as an sample for that row.
//         `,
//       }
    ]
  }
};
