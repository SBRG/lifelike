import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { select, Store } from '@ngrx/store';
import { BehaviorSubject, from } from 'rxjs';
import {
  catchError,
  exhaustMap,
  map,
  tap,
  withLatestFrom,
} from 'rxjs/operators';
import { Actions, ofType, createEffect } from '@ngrx/effects';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { Progress } from 'app/interfaces/common-dialog.interface';
import * as SnackbarActions from 'app/shared/store/snackbar-actions';
import {
  TermsOfServiceDialogComponent,
} from 'app/users/components/terms-of-service-dialog.component';
import { ErrorResponse } from 'app/shared/schemas/common';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { TERMS_OF_SERVICE } from 'app/users/components/terms-of-service-text.component';
import { ChangePasswordDialogComponent } from 'app/users/components/change-password-dialog.component';
import { AccountService } from 'app/users/services/account.service';
import { KeycloakAccountService } from 'app/users/services/keycloak-account.service';

import { AuthenticationService } from '../services/authentication.service';
import * as AuthActions from './actions';
import * as AuthSelectors from './selectors';
import { State } from './state';
import { LifelikeOAuthService } from '../services/oauth.service';

@Injectable()
export class AuthEffects {
  constructor(
    private readonly actions$: Actions,
    private readonly router: Router,
    private readonly store$: Store<State>,
    private readonly authService: AuthenticationService,
    private readonly oauthService: LifelikeOAuthService,
    private readonly accountService: AccountService,
    private readonly keycloakAccountService: KeycloakAccountService,
    private readonly modalService: NgbModal,
    private readonly progressDialog: ProgressDialog,
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

  updateUser$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.updateUser),
    exhaustMap(({userUpdateData, hashId}) => {
      const progressDialogRef = this.progressDialog.display({
        title: `Updating User`,
        progressObservables: [new BehaviorSubject<Progress>(new Progress({
          status: 'Updating user...',
        }))],
      });
      return this.accountService.updateUser(userUpdateData, hashId).pipe(
        map(() => {
          progressDialogRef.close();
          return AuthActions.updateUserSuccess({ userUpdateData });
        }),
        catchError((err: HttpErrorResponse) => {
          progressDialogRef.close();
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
        })
      );
    })),
  );

  updateUserSuccess$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.updateUserSuccess),
    map(_ => SnackbarActions.displaySnackbar({
      payload: {
        message: 'Your profile was successfully updated!',
        action: 'Dismiss',
        config: {duration: 5000},
      },
    })),
  ));

  updateOAuthUser$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.updateOAuthUser),
    exhaustMap(({userUpdateData}) => {
      const progressDialogRef = this.progressDialog.display({
        title: `Updating User`,
        progressObservables: [new BehaviorSubject<Progress>(new Progress({
          status: 'Updating user...',
        }))],
      });
      return this.keycloakAccountService.updateCurrentUser(userUpdateData).pipe(
        map(() => {
          progressDialogRef.close();
          return AuthActions.updateOAuthUserSuccess({ userUpdateData });
        }),
        catchError((err: HttpErrorResponse) => {
          progressDialogRef.close();
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
        })
      );
    })),
  );

  updateOAuthUserSuccess$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.updateOAuthUserSuccess),
    map(_ => {
      return SnackbarActions.displaySnackbar({
        payload: {
          message: 'Your profile was successfully updated!',
          action: 'Dismiss',
          config: {duration: 5000},
        },
      });
    }),
  ));

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

  oauthLogin$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.oauthLogin),
    exhaustMap(({oauthLoginData}) => {
      return this.accountService.getUserBySubject(oauthLoginData.subject).pipe(
        map(user => AuthActions.oauthLoginSuccess({lifelikeUser: user, oauthUser: oauthLoginData})),
        catchError((err: HttpErrorResponse) => {
          // If for some reason we can't retrieve the user from the database after authenticating, log them out and return to the home
          // page. Also, see the below Github issue:
          //    https://github.com/manfredsteyer/angular-oauth2-oidc/issues/9
          // `logOut(true)` will log the user out of Lifelike, but *not* out of the identity provider (e.g. the Keycloak server). The
          // likelihood of this error block occurring is probably very small (maybe the appserver went down temporarily), so ideally
          // we should make it as easy as possible to get the user logged in. This way, hopefully they will be able to wait a few moments
          // and refresh their browser to log in successfully.
          const error = (err.error as ErrorResponse).message;
          this.oauthService.logout(true);
          this.router.navigateByUrl('/dashboard');

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

  oauthLoginSuccess$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.oauthLoginSuccess),
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

  oauthLogout$ = createEffect(() => this.actions$.pipe(
    ofType(AuthActions.oauthLogout),
    tap(_ => this.oauthService.logout()),
  ), {dispatch: false});
}
