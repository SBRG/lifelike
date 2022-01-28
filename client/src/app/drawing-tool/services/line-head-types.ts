export interface LineHeadType {
  name: string;
  descriptor: string;
}

export const LINE_HEAD_TYPES: Map<string, LineHeadType> = new Map([
  ['none', {name: 'Blank', descriptor: 'none'}],
  ['arrow', {name: 'Arrow', descriptor: 'arrow'}],
  ['circle-arrow', {name: 'Circle Arrow', descriptor: 'arrow,spacer,circle'}],
  ['square-arrow', {name: 'Square Arrow', descriptor: 'arrow,spacer,square'}],
  ['cross-axis-arrow', {name: 'Cross-Axis Arrow', descriptor: 'arrow,spacer,cross-axis'}],
  ['cross-axis', {name: 'Cross-Axis', descriptor: 'cross-axis'}],
  ['diamond', {name: 'Diamond', descriptor: 'diamond'}],
  ['square', {name: 'Square', descriptor: 'square'}],
  ['circle', {name: 'Circle', descriptor: 'circle'}],
  ['double-cross-axis', {name: 'Double Cross-Axis', descriptor: 'cross-axis,cross-axis'}],
]);
