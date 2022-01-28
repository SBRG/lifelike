import { createReducer, on, Action } from '@ngrx/store';

import * as AuthActions from './actions';
import { initialState, State } from './state';

export const authFeatureKey = 'auth';

const authReducer = createReducer(
    initialState,
    on(
        AuthActions.loginSuccess,
        (state, { user }) => ({
            ...state,
            loggedIn: true,
            user,
        })
    ),
    on(
        AuthActions.loginRedirect,
        (state, { url }) => ({
            ...state,
            targetUrl: url,
        })
    ),
    on(
        AuthActions.logout,
        () => initialState,
    ),
    on(
        AuthActions.refreshUser,
        (state, { user }) => ({
            ...state,
            user,
        })
    ),
    on(
        AuthActions.loginReset,
        () => initialState,
    ),
    on(
          AuthActions.userUpdated,
          (state, { user }) => ({
              ...state,
              user,
          })
      ),
);

export function reducer(state: State, action: Action) {
    return authReducer(state, action);
}

export const getLoggedIn = (state: State) => state.loggedIn;

export const getUser = (state: State) => state.user;

export const getTargetUrl = (state: State) => state.targetUrl;
