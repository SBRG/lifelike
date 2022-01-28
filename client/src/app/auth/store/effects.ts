import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

import { select, Store } from '@ngrx/store';
import { from } from 'rxjs';
import {
  catchError,
  exhaustMap,
  map,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import * as SnackbarActions from 'app/shared/store/snackbar-actions';
import {
  TermsOfServiceDialogComponent,
} from 'app/users/components/terms-of-service-dialog.component';
import { ErrorResponse } from 'app/shared/schemas/common';
import { TERMS_OF_SERVICE } from 'app/users/components/terms-of-service-text.component';
import { ChangePasswordDialogComponent } from 'app/users/components/change-password-dialog.component';

import { AuthenticationService } from '../services/authentication.service';
import * as AuthActions from './actions';
import * as AuthSelectors from './selectors';
import { State } from './state';
import { successPasswordUpdate } from './actions';

@Injectable()
export class AuthEffects {
  constructor(
    private readonly actions$: Actions,
    private readonly router: Router,
    private readonly store$: Store<State>,
    private readonly authService: AuthenticationService,
    private readonly modalService: NgbModal,
    private readonly snackbar: MatSnackBar,
  ) {
  }

  checkTermsOfService$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.checkTermsOfService),
    map(({credential}) => {
      // Check if cookies to prove user read up to date ToS
      const cookie = this.authService.getCookie('terms_of_service');

      // Check if terms of service is up to date
      const outOfDate = cookie ? new Date(TERMS_OF_SERVICE.updateTimestamp) > new Date(cookie) : false;

      if (!cookie || outOfDate) {
        this.authService.eraseCookie('terms_of_service');

        const modalRef = this.modalService.open(TermsOfServiceDialogComponent);
        modalRef.result.then(() => {
          const timeStamp = TERMS_OF_SERVICE.updateTimestamp;

          this.store$.dispatch(AuthActions.agreeTermsOfService({
            credential,
            timeStamp,
          }));
        }, () => {
          this.store$.dispatch(AuthActions.disagreeTermsOfService());
        });
        return AuthActions.termsOfServiceAgreeing();
      } else {
        return AuthActions.login({credential});
      }
    }),
  ));

  termsOfServiceAgreeing$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.termsOfServiceAgreeing),
  ), {dispatch: false});

  agreeTermsOfService$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.agreeTermsOfService),
    exhaustMap(({
                  credential,
                  timeStamp,
                }) => {
      this.authService.setCookie('terms_of_service', timeStamp);
      return from([
        AuthActions.login({credential}),
      ]);
    }),
  ));

  disagreeTermsOfService$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.disagreeTermsOfService),
    exhaustMap(() => {
      return from([
        SnackbarActions.displaySnackbar({
          payload: {
            message: 'Access can not be granted until Terms of Service are accepted',
            action: 'Dismiss',
            config: {duration: 10000},
          },
        }),
      ]);
    }),
  ));

  updatePassword$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.updatePassword),
    map(() => {
        const modalRef = this.modalService.open(ChangePasswordDialogComponent);
        modalRef.result.then(() => {
          const timeStamp = TERMS_OF_SERVICE.updateTimestamp;
          return AuthActions.successPasswordUpdate();

        }, () => {
          this.store$.dispatch(AuthActions.failedPasswordUpdate());
          return this.store$.dispatch(AuthActions.logout());
        });
        return AuthActions.successPasswordUpdate();
    }),
  ));

  failedPasswordUpdate$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.failedPasswordUpdate),
    exhaustMap(() => {
      return from([
        SnackbarActions.displaySnackbar({
          payload: {
            message: 'Access can not be granted until the password is changed',
            action: 'Dismiss',
            config: {duration: 10000},
          },
        }),
      ]);
    }),
  ));

  successPasswordUpdate$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.successPasswordUpdate),
  ), {dispatch: false});

  login$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.login),
    exhaustMap(({credential}) => {
      const {email, password} = credential;
      return this.authService.login(email, password).pipe(
        map(user => AuthActions.loginSuccess({user: user.user})),
        catchError((err: HttpErrorResponse) => {
          const error = (err.error as ErrorResponse).message;
          return from([
            SnackbarActions.displaySnackbar({
              payload: {
                message: error,
                action: 'Dismiss',
                config: {duration: 10000},
              },
            }),
          ]);
        }),
      );
    })),
  );

  loginSuccess$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.loginSuccess),
    map( user => {
      if (user.user.resetPassword) {
          this.store$.dispatch(AuthActions.updatePassword());
      }
    }),
    withLatestFrom(this.store$.pipe(select(AuthSelectors.selectAuthRedirectUrl))),
    tap(([_, url]) => this.router.navigate([url])),
  ), {dispatch: false});

  loginRedirect$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.loginRedirect),
    tap(_ => this.router.navigate(['/login'])),
  ), {dispatch: false});

  logout$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.logout),
    map(_ => {
      this.authService.logout();
      this.router.navigate(['/login']);
      return SnackbarActions.displaySnackbar(
        {
          payload: {
            message: 'You are now logged out!',
            action: 'Dismiss',
            config: {duration: 5000},
          },
        },
      );
    }),
  ));
}
