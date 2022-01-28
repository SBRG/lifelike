import { createAction, props } from '@ngrx/store';

import { ChangePasswordRequest } from 'app/interfaces';

export const changePassword = createAction(
  '[User] Update User Password',
  props<{ userUpdates: ChangePasswordRequest }>(),
);

export const changePasswordSuccess = createAction(
  '[User] Update User Password Success',
);
