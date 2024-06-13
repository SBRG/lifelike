import { createAction, props } from '@ngrx/store';

import { AppUser, PrivateAppUser, Credential, UserUpdateData, OAuthLoginData } from 'app/interfaces';
import { LOGOUT_SUCCESS } from 'app/shared/constants';
import { KeycloakUserData } from 'app/users/interfaces';


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

export const oauthLogin = createAction(
  '[Auth] OAuth Login',
  props<{oauthLoginData: OAuthLoginData}>(),
);

export const oauthLoginSuccess = createAction(
  '[Auth] OAuth Login Success',
  props<{lifelikeUser: PrivateAppUser, oauthUser: OAuthLoginData}>(),
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

export const oauthLogout = createAction(
  '[Auth] OAuth Logout'
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

export const updateUser = createAction(
    '[Auth] Update user',
    props<{userUpdateData: UserUpdateData, hashId: string}>(),
);

export const updateUserSuccess = createAction(
  '[Auth] Update User Success',
  props<{userUpdateData: UserUpdateData}>(),
);

export const updateOAuthUser = createAction(
  '[Auth] Update OAuth user',
  props<{userUpdateData: KeycloakUserData}>(),
);

export const updateOAuthUserSuccess = createAction(
'[Auth] Update OAuth User Success',
props<{userUpdateData: KeycloakUserData}>(),
);
