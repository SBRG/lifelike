import { Prescaler } from 'app/shared-sankey/interfaces';

export enum PRESCALER_ID {
  none = 'None',
  ln = 'ln',
  log2 = 'log2',
  log10 = 'log10',
  sqrt = 'sqrt',
  cbrt = 'cbrt',
  one_by_x = '1/x',
  arctan = 'arctan'
}

export type PRESCALERS = { [prescalerId in PRESCALER_ID]: Prescaler };

export const prescalers: PRESCALERS = {
  [PRESCALER_ID.none]: {
    name: PRESCALER_ID.none,
    description: 'No transformation',
    fn: (v: number) => v
  },
  [PRESCALER_ID.ln]: {
    name: PRESCALER_ID.ln,
    description: 'Natural logarithm',
    fn: Math.log
  },
  [PRESCALER_ID.log2]: {
    name: PRESCALER_ID.log2,
    description: 'Base-2 logarithm',
    fn: v => Math.log2(v + 1)
  },
  [PRESCALER_ID.log10]: {
    name: PRESCALER_ID.log10,
    description: 'Base-10 logarithm',
    fn: v => Math.log10(v + 1)
  },
  [PRESCALER_ID.sqrt]: {
    name: PRESCALER_ID.sqrt,
    description: 'Square root',
    fn: Math.sqrt
  },
  [PRESCALER_ID.cbrt]: {
    name: PRESCALER_ID.cbrt,
    description: 'Cube root',
    fn: Math.cbrt
  },
  [PRESCALER_ID.one_by_x]: {
    name: PRESCALER_ID.one_by_x,
    description: 'Value multiplicative inverse',
    fn: v => 1 / v
  },
  [PRESCALER_ID.arctan]: {
    name: PRESCALER_ID.arctan,
    description: 'Arctangent',
    fn: Math.atan
  }
};
