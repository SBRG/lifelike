export interface LineType {
  name: string;
  descriptor: string;
}

export const LINE_TYPES: Map<string, LineType> = new Map([
  ['none', {name: 'Blank', descriptor: 'none'}],
  ['solid', {name: 'Solid', descriptor: 'solid'}],
  ['dashed', {name: 'Dashed', descriptor: 'dashed'}],
  ['long-dashed', {name: 'Long Dashed', descriptor: 'long-dash'}],
  ['dotted', {name: 'Dotted', descriptor: 'dotted'}],
  ['two-dashed', {name: 'Two-Dash', descriptor: 'two-dash'}],
]);
