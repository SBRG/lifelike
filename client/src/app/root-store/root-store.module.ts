import { NgModule } from '@angular/core';

import { EffectsModule } from '@ngrx/effects';
import {
    ActionReducer,
    ActionReducerMap,
    MetaReducer,
    StoreModule,
} from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { localStorageSync } from 'ngrx-store-localstorage';

import { UserFileImportModule } from 'app/user-file-import/user-file-import.module';
import { LOGOUT_SUCCESS } from 'app/shared/constants';

import { environment } from '../../environments/environment';
import { State } from './state';

/**
 * Syncs ngrx-store with local storage for persistent client state.
 */


/**
 * Our state is composed of a map of action reducer functions.
 * These reducer functions are called with each dispatched action
 * and the current or initial state and return a new immutable state.
 */
export const reducers: ActionReducerMap<State> = {};

/** Sync ngrx store with local storage */
export function syncWithLocalStorage(reducer: ActionReducer<State>): ActionReducer<State> {
    return localStorageSync({
        keys: ['auth'],
        rehydrate: true,
    })(reducer);
}

export function resetStateTree(reducer: ActionReducer<State>): ActionReducer<State> {
    return (state, action) => {
        if (action.type === LOGOUT_SUCCESS) {
            state = undefined;
        }
        return reducer(state, action);
    };
}

/**
 * By default, @ngrx/store uses combineReducers with the reducer map to compose
 * the root meta-reducer. To add more meta-reducers, provide an array of meta-reducers
 * that will be composed to form the root meta-reducer.
 */
export const metaReducers: MetaReducer<State>[] = !environment.production
   ? [syncWithLocalStorage, resetStateTree]
 : [syncWithLocalStorage, resetStateTree];


@NgModule({
    imports: [
        UserFileImportModule,
        /**
         * StoreModule.forRoot is imported once in the root module, accepting a reducer
         * function or object map of reducer functions. If passed an object of
         * reducers, combineReducers will be run creating your application
         * meta-reducer. This returns all providers for an @ngrx/store
         * based application.
         */
        StoreModule.forRoot(reducers, {
            metaReducers,
            // These are opt-in with NGRX 8, but will be on by default with the option to opt-out in future versions.
            // Karma also logs a bunch of warnings if we don't have them turned on.
            runtimeChecks: {
                strictStateImmutability: true,
                strictActionImmutability: true,
                strictStateSerializability: true,
                // setting to false because ngrx 8.6.0
                // prevents FormData and File objects
                // from being included in actions
                // as they're non-serializable
                // breaks file uploads
                strictActionSerializability: false,
              },
        }),

        /**
         * Store devtools instrument the store retaining past versions of state
         * and recalculating new states. This enables powerful time-travel
         * debugging.
         *
         * To use the debugger, install the Redux Devtools extension for either
         * Chrome or Firefox
         *
         * See: https://github.com/zalmoxisus/redux-devtools-extension
         */
        StoreDevtoolsModule.instrument({
            name: 'KG Prototypes',
            logOnly: environment.production,
        }),

        /**
         * EffectsModule.forRoot() is imported once in the root module and
         * sets up the effects class to be initialized immediately when the
         * application starts.
         *
         * See: https://github.com/ngrx/platform/blob/master/docs/effects/api.md#forroot
         */
        EffectsModule.forRoot([]),
    ],
    providers: [],
})
export class RootStoreModule {}
