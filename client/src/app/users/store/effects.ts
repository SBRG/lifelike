import { EventEmitter, Injectable, Output } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, exhaustMap, map, switchMap } from 'rxjs/operators';
import { from } from 'rxjs';

import { SnackbarActions } from 'app/shared/store';
import { ErrorResponse } from 'app/shared/schemas/common';

import { AccountService } from '../services/account.service';
import * as UserActions from './actions';

@Injectable()
export class UserEffects {
    constructor(
        public actions$: Actions,
        private accountService: AccountService,
    ) {}

    updateUserPassword$ = createEffect(() => this.actions$.pipe(
        ofType(UserActions.changePassword),
        exhaustMap(({ userUpdates }) => {
            return this.accountService.changePassword(userUpdates).pipe(
                switchMap(() => [UserActions.changePasswordSuccess()]),
                catchError((err: HttpErrorResponse) => {
                    const error = (err.error as ErrorResponse).message;
                    return from([
                        SnackbarActions.displaySnackbar({payload: {
                            message: error,
                            action: 'Dismiss',
                            config: { duration: 10000 },
                        }})
                    ]);
                }),
            );
        })
    ));

    updateUserPasswordSuccess$ = createEffect(() => this.actions$.pipe(
        ofType(UserActions.changePasswordSuccess),
        map(_ => SnackbarActions.displaySnackbar(
            {payload: {
                message: 'Update success!',
                action: 'Dismiss',
                config: { duration: 10000 },
            }}
        )),
    ));
}
