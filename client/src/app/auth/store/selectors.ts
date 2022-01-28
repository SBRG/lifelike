import {
    createFeatureSelector,
    createSelector,
} from '@ngrx/store';

import { AppUser } from 'app/interfaces';

import { State } from './state';
import * as fromAuth from './reducer';

export const selectAuthState = createFeatureSelector<State>(fromAuth.authFeatureKey);

export const selectAuthLoginState = createSelector(
    selectAuthState,
    fromAuth.getLoggedIn,
);

export const selectAuthUser = createSelector(
    selectAuthState,
    fromAuth.getUser,
);

export const selectAuthRedirectUrl = createSelector(
    selectAuthState,
    fromAuth.getTargetUrl,
);

export const selectAuthLoginStateAndUser = createSelector(
    selectAuthLoginState,
    selectAuthUser,
    (loggedIn: boolean, user: AppUser) => {
        return {loggedIn, user};
    }
);

export const selectRoles = createSelector(
    selectAuthUser,
    (user: AppUser) => {
        return user ? user.roles : [];
    }
);
