import {
  SankeyLink,
  SankeyState,
  SankeyNode,
  SankeyData,
  SankeyTrace,
  SelectionType,
  SelectionEntity,
  SankeyOptions
} from 'app/shared-sankey/interfaces';
import { GraphTrace } from 'app/shared/providers/graph-type/interfaces';

export interface SankeyManyToManyStateExtend {
  highlightCircular: boolean;
  colorLinkByType: boolean;
}

export type SankeyManyToManyState = SankeyState & SankeyManyToManyStateExtend;

export interface SankeyManyToManyOptionsExtend {
  colorLinkTypes: { [type: string]: string };
}

export type SankeyManyToManyOptions = SankeyOptions & SankeyManyToManyOptionsExtend;

export interface SankeyManyToManyLink extends SankeyLink {
  _graphRelativePosition?: 'left' | 'right' | 'multiple';
  _visited?: string | number;
  _traces?: SankeyTrace[];
}

export interface SankeyManyToManyNode extends SankeyNode {
  _source: SankeyManyToManyLink;
  _target: SankeyManyToManyLink;
}

export interface SankeyManyToManyData extends SankeyData {
  links: SankeyManyToManyLink[];
  nodes: SankeyManyToManyNode[];
}


// region Selection
export type SelectionManyToManyEntity = SelectionEntity | {
  [SelectionType.link]: SankeyManyToManyLink;
};
// endregion

export type SankeyManyToManySelection = {
  node: SankeyManyToManyNode
} | {
  link: SankeyManyToManyLink
} | {
  trace: SankeyTrace
};
