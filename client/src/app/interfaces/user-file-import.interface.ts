export interface ColumnNameIndex {
    // key is column name
    // value is column index
    [key: string]: number;
}

export interface SheetRowPreview {
    [key: string]: string;
}

// parsed worksheet sheet name and sheet column names
export interface SheetNameAndColumnNames {
    sheetName: string;
    sheetColumnNames: ColumnNameIndex[];
    sheetPreview: SheetRowPreview[];
}

export interface FileNameAndSheets {
    sheets: SheetNameAndColumnNames[];
    filename: string;
}

export interface NodeMappingHelper {
    // the key is the column index
    // meaning a column can represent a node
    mapping: {
        // any previously created mapping from previous uploads
        existingMappings: {[key: number]: Neo4jNodeMapping};
        // new node and it's mappings
        newMappings: {[key: number]: Neo4jNodeMapping};
        delimiters: {[key: number]: string};
    };
}

export interface Neo4jNodeMapping {
    domain: string;
    edge?: string;
    nodeType: string;
    nodeProperties?: { [key: number]: string };
    // the mappedNode properties are for
    // mapping columns to previously created
    // node types from other columns
    mappedNodeType?: string;
    mappedNodePropertyFrom?: { [key: number]: string };
    mappedNodePropertyTo?: string;
    uniqueProperty?: string;  // the unique prop to filter on in Neo4j to create relationship between newly created nodes
    // if user wants to great a relationship
    // between a column and existing graph node
    // not another column
    mappedToUniversalGraph?: {
        universalGraphNodeType: string;
        universalGraphNodePropertyLabel: string;
    };
}

/**
 * The use of numbers represent the column index used to filter.
 */
export interface Neo4jRelationshipMapping {
    edge?: { [key: number]: string };  // if newly created edge (i.e user input) set key to negative number
    edgeProperty?: { [key: number]: string };
    sourceNode?: Neo4jNodeMapping;
    targetNode?: Neo4jNodeMapping;
}

export interface Neo4jColumnMapping {
    newNodes: Neo4jNodeMapping[];
    existingNodes: Neo4jNodeMapping[];
    relationships: Neo4jRelationshipMapping[];
    delimiters: {[key: number]: string};
    fileName: string;
    sheetName: string;
}
