import { ReferenceType } from 'app/shared/references';

export interface UniversalGraphRelationship {
  node1: UniversalGraphNode;
  node2: UniversalGraphNode;
  edge: UniversalGraphEdge;
}

export interface UniversalEntityData {
  references?: Reference[];
  hyperlinks?: Hyperlink[];
  detail?: string;
  search?: Hyperlink[];
  subtype?: string;
  sources?: Source[];
}

export interface UniversalNodeStyle {
  fontSizeScale?: number;
  fillColor?: string;
  strokeColor?: string;
  lineType?: string;
  lineWidthScale?: number;
  showDetail?: boolean;
}

export interface UniversalGraphNode {
  data: {
    x: number;
    y: number;
    width?: number,
    height?: number,
  } & UniversalEntityData;
  display_name: string;
  hash: string;
  shape?: string;
  icon?: {
    code: string,
    color: string,
    face: string,
    size: number,
    weight: string,
  };
  image_id?: string;
  label: string;
  sub_labels: string[];
  style?: UniversalNodeStyle;
}

export type UniversalGraphNodeTemplate =
  Pick<UniversalGraphNode, 'display_name' | 'label' | 'sub_labels'>
  & { data?: Partial<UniversalEntityData>, style?: Partial<UniversalNodeStyle> };

export interface UniversalEdgeStyle {
  fontSizeScale?: number;
  strokeColor?: string;
  lineType?: string;
  lineWidthScale?: number;
  sourceHeadType?: string;
  targetHeadType?: string;
}

export interface UniversalGraphEdge {
  data?: UniversalEntityData;
  label: string;
  from: string;
  to: string;
  style?: UniversalEdgeStyle;
}

export interface UniversalGraph {
  nodes: UniversalGraphNode[];
  edges: UniversalGraphEdge[];
}

export declare type UniversalGraphEntity = UniversalGraphNode | UniversalGraphEdge;

export enum GraphEntityType {
  Node = 'node',
  Edge = 'edge',
}

export interface GraphEntity {
  type: GraphEntityType;
  entity: UniversalGraphEntity;
}

export interface Hyperlink {
  url: string;
  domain: string;
}

export interface Source {
  type?: ReferenceType;
  url: string;
  domain?: string;
}

export interface Reference {
  type: ReferenceType;
  id: string;
}

/**
 * Interface for launching app wit parameters
 */
export interface LaunchApp {
  app: string;
  arg?: {
    // For pdf-viewer, coordinate of the nnoation of pd
    coords?: number[],
    // hash of pdf to locate by
    fileId?: string,
    // page of the pdf that the annotation is located on
    pageNumber?: number
  };
}

/**
 * Map schema definition
 */
export interface KnowledgeMap {
  id?: string | number;
  author?: string;
  label: string;
  description: string;
  /** JSON representation of graph */
  graph: UniversalGraph;
  /** ISO-8601 timestamp of when project was last updated */
  modified_date?: string;
  /** Whether or not project is public to userbase */
  public?: boolean;
  /** URI for project */
  hash_id?: string;
  /** ID of the user who made the project */
  user_id?: number;
  /** Name of the project this map is found in */
  project_name?: string;
}

export const MAP_TYPE_ID = 'LifelikeKnowledgeMap/1';
export const NODE_TYPE_ID = 'LifelikeKnowledgeNode/1';

export const DETAIL_NODE_LABELS = new Set(['note', 'link', 'image']);

export function isCommonNodeDisplayName(label: string, displayName: string) {
  return displayName.toLowerCase() === label.toLowerCase();
}
