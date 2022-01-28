import { PRESCALERS } from 'app/sankey-viewer/components/algorithms/prescalers';
import { LINK_PALETTES } from 'app/sankey-viewer/components/color-palette';
import { GraphTraceNetwork, GraphGraph, GraphLink, GraphNode, GraphFile } from 'app/shared/providers/graph-type/interfaces';
import { RecursivePartial } from 'app/shared/schemas/common';
import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';

// Re-export the interfaces which are defined separately for DOMless ussage
import { SankeyTrace, SankeyNode, SankeyLink } from './pure_interfaces';

export * from './pure_interfaces';

// region UI options
export interface ValueAccessor {
  description: string;
  help?: string;
}

export interface IntermediateProcessedData extends Partial<SankeyData> {
  _sets: object;
}

export type ValueProcessingStep = (this: SankeyControllerService, v: SankeyData) => IntermediateProcessedData | undefined;

export interface ValueGenerator extends ValueAccessor {
  disabled?: (this: SankeyControllerService) => boolean;
  preprocessing: ValueProcessingStep;
  postprocessing?: ValueProcessingStep;
}

export interface MultiValueAccessor extends ValueAccessor {
  callback: () => void;
}

export interface Prescaler {
  name: string;
  description: string;
  fn: (v: number) => number;
}

export interface Palette {
  name: string;
  palette: (size: number, params: object) => (i: number) => string | object;
  help?: string;
}

interface SankeyNodeHeight {
  min: {
    enabled: boolean,
    value: number
  };
  max: {
    enabled: boolean,
    ratio: number
  };
}

export interface NodeValueAccessor {
  [nodeValuePropertyName: string]: ValueGenerator;
}

export interface LinkValueAccessor {
  [linkValuePropertyName: string]: ValueGenerator;
}

export type PREDEFINED_VALUE_ACCESSORS = {
  [linkValueGeneratorId in PREDEFINED_VALUE]: MultiValueAccessor
};

export enum LINK_VALUE_GENERATOR {
  fixedValue0 = 'Fixed Value = 0',
  fixedValue1 = 'Fixed Value = 1',
  input_count = 'Input count',
  fraction_of_fixed_node_value = 'Fraction of fixed node value',
}

type LINK_VALUE_GENERATORS = {
  [linkValueGeneratorId in LINK_VALUE_GENERATOR]: ValueGenerator
};

type NODE_VALUE_GENERATORS = {
  [linkValueGeneratorId in NODE_VALUE_GENERATOR]: ValueGenerator
};

export enum NODE_VALUE_GENERATOR {
  none = 'None',
  fixedValue1 = 'Fixed Value = 1'
}

export enum PREDEFINED_VALUE {
  fixed_height = 'Fixed height',
  input_count = 'Input count'
}

export interface SankeyOptions {
  networkTraces: Array<SankeyTraceNetwork>;
  prescalers: PRESCALERS;
  nodeValueAccessors: NodeValueAccessor;
  linkValueAccessors: LinkValueAccessor;
  predefinedValueAccessors: PREDEFINED_VALUE_ACCESSORS;
  nodeValueGenerators: NODE_VALUE_GENERATORS;
  linkValueGenerators: LINK_VALUE_GENERATORS;
  linkPalettes: LINK_PALETTES;
}

export interface SankeyState {
  nodeAlign: 'right' | 'left';
  networkTraceIdx: number;
  nodeHeight: SankeyNodeHeight;
  prescalerId: string;
  nodeValueAccessorId: string;
  linkValueAccessorId: string;
  predefinedValueAccessorId: string;
  normalizeLinks: boolean;
  linkPaletteId: string;
  labelEllipsis: {
    enabled: boolean,
    value: number
  } | undefined;
  fontSizeScale: number;
  viewName?: string;
  baseViewName?: ViewBase;
}

// endregion


export interface SankeyTraceNetwork extends GraphTraceNetwork {
  traces: Array<SankeyTrace>;
}

export interface SankeyGraph extends GraphGraph {
  trace_networks: Array<SankeyTraceNetwork>;
}

export interface SankeyLinksOverwrites {
  [linkId: string]: Partial<GraphLink>;
}

export interface SankeyNodesOverwrites {
  [nodeId: string]: Partial<GraphNode>;
}

export interface SankeyView {
  state: object & SankeyState;
  base: string;
  size: { width: number, height: number };
  nodes: SankeyNodesOverwrites;
  links: SankeyLinksOverwrites;
}

export type SankeyApplicableView = RecursivePartial<SankeyView> & Pick<SankeyView, 'base'>;

export interface SankeyViews {
  [viewName: string]: SankeyView;
}

export interface SankeyData extends GraphFile {
  graph: SankeyGraph;
  nodes: Array<SankeyNode>;
  links: Array<SankeyLink>;

  _inNodes?: Array<number>;
  _outNodes?: Array<number>;

  _views: SankeyViews;
}

// endregion

export enum SankeyURLLoadParam {
  NETWORK_TRACE_IDX = 'network_trace',
  VIEW_NAME = 'view',
  BASE_VIEW_NAME = 'base_view',
  SEARCH_TERMS = 'search_terms'
}

export interface SankeyURLLoadParams {
  [SankeyURLLoadParam.NETWORK_TRACE_IDX]: number;
  [SankeyURLLoadParam.VIEW_NAME]?: string;
  [SankeyURLLoadParam.BASE_VIEW_NAME]?: string;
  [SankeyURLLoadParam.SEARCH_TERMS]?: string;
}

// region Selection
export enum SelectionType {
  // assign values to use in template
  link = 'link',
  node = 'node',
  trace = 'trace'
}

export type SelectionEntity = {
  [SelectionType.link]: SankeyLink;
} | {
  [SelectionType.node]: SankeyNode;
} | {
  [SelectionType.trace]: SankeyTrace;
};

// endregion

// region Path report
export interface SankeyPathReportEntity {
  label: string;
  row: number;
  column: number;
  type: 'node' | 'link' | 'spacer';
}

export interface SankeyPathReport {
  [networkTrace: string]: SankeyPathReportEntity[][];
}

// endregion

// Do not change! tightly coupled with url
export enum ViewBase {
  sankey = 'sankey',
  sankeyManyToMany = 'sankey-many-to-many'
}

export interface ViewSize {
  width: number;
  height: number;
}
