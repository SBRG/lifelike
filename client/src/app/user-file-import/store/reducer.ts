import { Action, createReducer, on } from '@ngrx/store';

import {
    initialState,
    State,
} from './state';
import * as UserFileImportActions from './actions';

export const userFileImportReducer = createReducer(
    initialState,
    on(
        UserFileImportActions.getDbLabelsSuccess,
        (state, action) => ({
            ...state,
            dbLabels: action.payload,
        }),
    ),
    on(
        UserFileImportActions.getDbRelationshipTypesSuccess,
        (state, action) => ({
            ...state,
            dbRelationshipTypes: action.payload,
        }),
    ),
    on(
        UserFileImportActions.getNodePropertiesSuccess,
        (state, action) => ({
            ...state,
            nodeProperties: {...state.nodeProperties, ...action.payload},
        }),
    ),
    on(
        UserFileImportActions.uploadExperimentalDataFileSuccess,
        (state, action) => ({
            ...state,
            fileNameAndSheets: action.payload,
        }),
    ),
    on(
        UserFileImportActions.saveNodeMapping,
        (state, action) => ({
            ...state,
            nodeMappingHelper: action.payload,
        }),
    ),
);

export function reducer(state: State, action: Action) {
    return userFileImportReducer(state, action);
}
