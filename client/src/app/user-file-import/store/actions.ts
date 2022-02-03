import { createAction, props, union } from '@ngrx/store';

import { Neo4jColumnMapping, FileNameAndSheets, NodeMappingHelper } from 'app/interfaces/user-file-import.interface';


export const uploadExperimentalDataFile = createAction(
    '[Importer] Upload Experimental Data File',
    props<{payload: FormData}>(),
);

export const uploadExperimentalDataFileSuccess = createAction(
    '[Importer] Upload Experimental Data File Success',
    props<{payload: FileNameAndSheets}>(),
);

export const uploadNodeMapping = createAction(
    '[Importer] Upload Node Mapping',
    props<{payload: Neo4jColumnMapping}>(),
);

export const uploadNodeMappingSuccess = createAction(
    '[Importer] Upload Node Mapping Success',
);

export const getDbLabels = createAction(
    '[Importer] Get Database Labels',
);

export const getDbLabelsSuccess = createAction(
    '[Importer] Get Database Labels Success',
    props<{payload: string[]}>(),
);

export const getDbRelationshipTypes = createAction(
    '[Importer] Get Database Relationship Types',
);

export const getDbRelationshipTypesSuccess = createAction(
    '[Importer] Get Database Relationship Types Success',
    props<{payload: string[]}>(),
);

export const getNodeProperties = createAction(
    '[Importer] Get Node Properties',
    props<{payload: string}>(),
);

export const getNodePropertiesSuccess = createAction(
    '[Importer] Get Node Properties Success',
    props<{payload: {[key: string]: string[]}}>(),
);

export const saveNodeMapping = createAction(
    '[Importer] Save Node Mapping Helper',
    props<{payload: NodeMappingHelper}>(),
);

const all = union({
    getDbLabels,
    getDbLabelsSuccess,
    getNodeProperties,
    getNodePropertiesSuccess,
    getDbRelationshipTypes,
    getDbRelationshipTypesSuccess,
    uploadExperimentalDataFile,
    uploadExperimentalDataFileSuccess,
    uploadNodeMapping,
    uploadNodeMappingSuccess,
    saveNodeMapping,
});

export type Neo4jActions = typeof all;
