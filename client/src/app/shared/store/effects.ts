import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Actions, createEffect, ofType, } from '@ngrx/effects';
import { map, tap } from 'rxjs/operators';

import { displaySnackbar } from './snackbar-actions';
import { displayMessageDialog } from './message-dialog-actions';
import { MessageDialog } from '../services/message-dialog.service';

@Injectable()
export class SharedNgrxEffects {
  constructor(
    private actions$: Actions,
    private snackBar: MatSnackBar,
    private messageDialog: MessageDialog,
  ) {
  }

  displaySnackbar$ = createEffect(() => this.actions$.pipe(
    ofType(displaySnackbar),
    map(action => action.payload),
    tap(payload => this.snackBar.open(payload.message, payload.action, payload.config)
    )), {dispatch: false});

  displayMessageDialog$ = createEffect(() => this.actions$.pipe(
    ofType(displayMessageDialog),
    map(action => action.payload),
    tap(payload => this.messageDialog.display(payload)
    )), {dispatch: false});
}
