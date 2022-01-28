export interface NodeLegend {
    [key: string]: {
        color: string;
        label: string;
    };
}

/** Node representation from the backend */
export interface GraphNode {
  id: number;
  label: string;
  data: {[key: string]: any};
  subLabels: Array<string>;
  displayName: string;
  domainLabels: string[];
  entityUrl: string;
}

/** Edge represenattion from the backend */
export interface GraphRelationship {
  id: number;
  label: string;
  data: {[key: string]: any};
  to: number;
  from: number;
  toLabel: string;
  fromLabel: string;
}

/** VisJS Node Representations for Client */
export interface VisNode extends GraphNode {
  primaryLabel?: string; // Label to display in VisJS
  color: any; // VisJS color options
  font: any; // VisJS font options
  expanded?: boolean; // Whether a node has been expanded
}

export interface DuplicateVisNode extends VisNode {
    id: any;
    duplicateOf: number;
}

/** VisJS Edge Representations for Client */
export interface VisEdge extends GraphRelationship {
  arrows?: string;
  color: any;
}

// TODO: For DuplicateVisEdge, `to` and `from` are actually string types in the shape 'duplicateEdge:{hash}'.
// We may want to update this interface so the type is reflected properly.
export interface DuplicateVisEdge extends VisEdge {
    id: any;
    duplicateOf: number | null;
    originalFrom: number | null;
    originalTo: number | null;
}

export interface Neo4jResults {
  nodes: Array<GraphNode | VisNode>;
  edges: Array<GraphRelationship | VisEdge>;
}

// Used for vis.js configuration
// https://visjs.github.io/vis-network/docs/network/configure.html#
export interface Neo4jGraphConfig {
  [key: string]: any;
}

export interface AssociationSentence {
    entry1Text: string;
    entry2Text: string;
    id: string;
    sentence: string;
}

export interface FTSQueryRecord {
  node: GraphNode;
  taxonomyId?: number;
  taxonomyName?: string;
  goClass?: string;
}

export interface FTSReferenceRecord extends FTSQueryRecord {
  publicationTitle: string;
  publicationYear: number;
  publicationId: number;
  relationship: string;
  chemical?: GraphNode;
  disease?: GraphNode;
}

export interface FTSResult {
  query: string;
  nodes: Array<FTSQueryRecord>;
  total: number;
  page: number;
  limit: number;
}

export interface SearchRecord {
  nodeId: number;
  label: string;
  subLabels: Array<string>;
  data: string;
  dataId: string;
}

export interface OrganismsResult {
  limit: number;
  nodes: OrganismAutocomplete;
  query: string;
  total: number;
}

export interface OrganismAutocomplete {
  organism_name: string;
  synonym: string;
  tax_id: string;
}

export interface Domain {
  id: string;
  name: string;
  label: string;
}

export interface EntityType {
  id: string;
  name: string;
  label: string;
}
