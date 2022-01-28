import { createAction, props, union } from '@ngrx/store';

export const displaySnackbar = createAction(
    '[Importer] Display Snackbar',
    props<{payload: {
        message: string,
        action: string,
        config: any,
    }}>(),
);

const all = union({displaySnackbar});

export type SnackbarActions = typeof all;
