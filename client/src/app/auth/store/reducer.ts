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
      AuthActions.oauthLoginSuccess,
      (state, { lifelikeUser, oauthUser }) => ({
          ...state,
          loggedIn: true,
          user: {
            // Note: Order is important here!
            ...state.user,
            ...lifelikeUser,
            firstName: oauthUser.firstName,
            lastName: oauthUser.lastName,
            username: oauthUser.username
          },
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
      AuthActions.oauthLogout,
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
        AuthActions.updateUserSuccess,
        (state, { userUpdateData }) => ({
            ...state,
            user: {
              // NOTE: Be *very* careful with nested updates! We need to make sure we expand *all* levels of the nested object, not just
              // the first. In this case, `user` does not have any nested objects itself, but if it did, we ought to expand them.
              ...state.user,
              ...userUpdateData
            },
        })
    ),
    on(
      AuthActions.updateOAuthUserSuccess,
      (state, { userUpdateData }) => ({
          ...state,
          user: {
            // See the above comment for updateUserSuccess!
            ...state.user,
            firstName: userUpdateData.firstName,
            lastName: userUpdateData.lastName,
            username: userUpdateData.username,
          },
      })
  ),
);

export function reducer(state: State, action: Action) {
    return authReducer(state, action);
}

export const getLoggedIn = (state: State) => state.loggedIn;

export const getUser = (state: State) => state.user;

export const getTargetUrl = (state: State) => state.targetUrl;
