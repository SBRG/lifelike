import { createAction, props, union } from '@ngrx/store';

import { MessageArguments } from '../services/message-dialog.service';

export const displayMessageDialog = createAction(
  '[Importer] Display Message Dialog',
  props<{payload: MessageArguments}>(),
);

const all = union({displayMessageDialog});

export type MessageDialogActions = typeof all;
