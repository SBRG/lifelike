import { createAction, props } from '@ngrx/store';

import { AppUser, PrivateAppUser, Credential } from 'app/interfaces';
import { LOGOUT_SUCCESS } from 'app/shared/constants';


export const checkTermsOfService = createAction(
    '[Auth] Check Terms Of Service',
    props<{credential: Credential}>(),
);

export const termsOfServiceAgreeing = createAction(
    '[Auth] Open dialog to Terms Of Service',
);

export const agreeTermsOfService = createAction(
    '[Auth] Agree to Terms Of Service',
    props<{ credential: Credential, timeStamp: string }>()
);

export const disagreeTermsOfService = createAction(
    '[Auth] Disagree to Terms Of Service',
);

export const login = createAction(
    '[Auth] Login',
    props<{credential: Credential}>(),
);

export const loginSuccess = createAction(
    '[Auth] Login Success',
    props<{user: PrivateAppUser}>(),
);

export const loginFailure = createAction(
    '[Auth] Login Failure',
);

/** A login redirect carries the original requested url */
export const loginRedirect = createAction(
    '[Auth] Login Redirect',
    props<{url: string}>(),
);

export const logout = createAction(
    '[Auth] Logout'
);

/** Used when an update is performed on a logged in user */
export const refreshUser = createAction(
    '[Auth] Refresh User',
    props<{user: AppUser}>(),
);

export const loginReset = createAction(
    '[Auth] Login Reset'
);

export const logoutSuccess = createAction(LOGOUT_SUCCESS);

export const failedPasswordUpdate = createAction(
  '[Auth] Initial Password Update Failed'
);

export const successPasswordUpdate = createAction(
  '[Auth] Initial Password Updated Successfully'
);

export const updatePassword = createAction(
  '[Auth] Changing Initial Password',
);

export const userUpdated = createAction(
    '[Auth] Updated user',
    props<{user: PrivateAppUser}>(),
);
