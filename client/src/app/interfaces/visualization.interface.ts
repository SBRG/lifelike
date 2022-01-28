import { IdType } from 'vis-network';

import {
    GraphNode,
    VisEdge,
    VisNode,
    DuplicateVisNode,
    DuplicateVisEdge
} from './neo4j.interface';

// Begin Misc. Interfaces
export interface AssociationSnippet {
    reference: Reference;
    publication: Publication;
}

export enum AssociatedType {
  LITERATURE_GENE = 'LiteratureGene',
  LITERATURE_CHEMICAL = 'LiteratureChemical',
  LITERATURE_DISEASE = 'LiteratureDisease'
}

export interface AssociatedTypeEntry {
  id: number;
  name: string;
  count: number;
  percentage: number;
}

export interface NodeAssociatedType {
    name: string;
    nodeId: number;
    snippetCount: number;
}

export interface ClusterData {
    referenceTableRows: ReferenceTableRow[];
    relationship: string;
    direction: Direction;
}

export enum Direction {
    TO = 'Incoming',
    FROM = 'Outgoing',
}

export interface DuplicateEdgeConnectionData {
    from: number;
    to: number;
    originalFrom: number;
    originalTo: number;
    fromLabel: string;
    toLabel: string;
    label: string;
}

export interface NodePair {
  // Note that it's inaccurate to use "from" and "to" terminology here, since the nodes *may* have bidirectional relationships.
  node1Id: number;
  node2Id: number;
}

export interface DuplicateNodeEdgePair {
    node: DuplicateVisNode;
    edge: DuplicateVisEdge;
}

export interface EdgeConnectionData {
    from: number;
    to: number;
    fromLabel: string;
    toLabel: string;
    label: string;
}

export interface Publication extends GraphNode {
    data: {
        journal: string;
        title: string;
        pmid: string;
        pubYear: number;
    };
}

export interface Reference extends GraphNode {
    data: {
        entry1Text: string;
        entry2Text: string;
        entry1Type: string;
        entry2Type: string;
        id: string;
        sentence: string;
    };
}

export interface ReferenceTablePair {
    node: {
        id: string;
        displayName: string;
        label: string;
    };
    edge: {
        originalFrom: number;
        originalTo: number;
        label: string;
    };
}

export interface ReferenceTableRow {
    nodeId: string;
    nodeDisplayName: string;
    nodeLabel: string;
    snippetCount: number;
}

export interface SettingsFormControl {
    value: any;
    valid: boolean;
}

export interface SettingsFormValues {
    animation: SettingsFormControl;
    maxClusterShownRows: SettingsFormControl;
    [key: string]: SettingsFormControl; // Could be any number of node entity checkboxes
}

export enum SidenavEntityType {
  EMPTY,
  NODE,
  EDGE,
  CLUSTER,
  TYPE,
}

export interface SidenavClusterEntity {
    queryData: DuplicateEdgeConnectionData[];
    snippetData: SidenavSnippetData[];
    totalResults: number;
}

export interface SidenavEdgeEntity {
    queryData: EdgeConnectionData;
    snippetData: SidenavSnippetData;
    totalResults: number;
}

export interface SidenavNodeEntity {
    data: VisNode;
    edges: VisEdge[];
}

export interface SidenavTypeEntity {
    sourceNode: VisNode;
    connectedNodes: VisNode[];
    type: AssociatedType;
}

export interface NodeDisplayInfo {
    primaryLabel: string;
    displayName: string;
    url: string;
}

export interface SidenavSnippetData {
    to: NodeDisplayInfo;
    from: NodeDisplayInfo;
    association: string;
    snippets: AssociationSnippet[];
}

// End Misc. Interfaces

// Begin Request Interfaces

export interface ExpandNodeRequest {
    nodeId: number;
    filterLabels: string[];
}

export interface GroupRequest {
    relationship: string;
    node: IdType;
    direction: Direction;
}

export interface NewClusterSnippetsPageRequest {
    queryData: DuplicateEdgeConnectionData[];
    page: number;
    limit: number;
}

export interface NewEdgeSnippetsPageRequest {
    queryData: EdgeConnectionData;
    page: number;
    limit: number;
}

export interface NewNodePairSnippetsPageRequest {
  queryData: NodePair;
  page: number;
  limit: number;
}

export interface ReferenceTableDataRequest {
    nodeEdgePairs: ReferenceTablePair[];
}

export interface AssociatedTypeSnippetCountRequest {
    source_node: number;
    associated_nodes: number[];
}

// End Request Interfaces

// Begin Response Interfaces

export interface ExpandNodeResult {
    expandedNode: number;
    nodes: VisNode[];
    edges: VisEdge[];
}

export interface GetEdgeSnippetsResult {
    queryData: EdgeConnectionData;
    snippetData: GetSnippetsResult;
    totalResults: number;
}

export interface GetClusterSnippetsResult {
    queryData: DuplicateEdgeConnectionData[];
    snippetData: GetSnippetsResult[];
    totalResults: number;
}

export interface GetNodePairSnippetsResult {
  queryData: NodePair;
  snippetData: GetSnippetsResult[];
  totalResults: number;
}

export interface GetReferenceTableDataResult {
    referenceTableRows: ReferenceTableRow[];
    direction: Direction;
}

export interface GetSnippetsResult {
    snippets: AssociationSnippet[];
    fromNodeId: number;
    toNodeId: number;
    association: string;
}

export interface GetAssociatedTypeResult {
    associatedData: NodeAssociatedType[];
}

// End Response Interfaces
