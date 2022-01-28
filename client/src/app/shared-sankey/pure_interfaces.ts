/**
 * Separated from interfaces.ts so it can be imported in webworker enviroment
 */
import { GraphNode, GraphLink, GraphTrace } from 'app/shared/providers/graph-type/interfaces';

// region Graph as Sankey
// Add properties used internally to compute layout
export type SankeyId = string | number;

export interface SankeyNode extends GraphNode {
  // Temp definitions to fix LL-3499
  sourceLinks?: Array<SankeyLink>;
  targetLinks?: Array<SankeyLink>;
  // End temp definitions

  _id: SankeyId;
  _index?: number | string;
  _sourceLinks?: Array<SankeyLink>;
  _targetLinks?: Array<SankeyLink>;
  _y0?: number;
  _y1?: number;
  _x0?: number;
  _x1?: number;
  _depth?: number;
  _reversedDepth?: number;
  _height?: number;
  _value?: number;
  _fixedValue?: number;
  _layer?: number;
  _color?: string;
  _order?: number;
}

export interface SankeyLink extends GraphLink {
  l: number[];
  _id: SankeyId;
  _trace?: SankeyTrace;
  _source?: SankeyNode | string | number;
  _target?: SankeyNode | string | number;
  _sourceLinks?: SankeyLink[];
  _targetLinks?: SankeyLink[];
  _width?: number;
  _y0?: number;
  _y1?: number;
  _multiple_values?: [number, number];
  _adjacent_divider?: number;
  _circularLinkID?: number;
  _circular?: boolean;
  _folded?: boolean;
  _value: number;
  _order?: number;
  _color?: string;
}

export interface SankeyTrace extends GraphTrace {
  _color: string;
  _group: GraphTrace['group'] | string;
}
