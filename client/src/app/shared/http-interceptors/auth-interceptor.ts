import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';

import {
    BehaviorSubject,
    Observable,
    throwError,
} from 'rxjs';
import {
    catchError,
    switchMap,
    filter,
    take,
} from 'rxjs/operators';
import { Store } from '@ngrx/store';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { State } from 'app/root-store';
import { AuthActions } from 'app/auth/store';
import { SnackbarActions } from 'app/shared/store';

import { environment } from '../../../environments/environment';


/**
 * AuthenticationInterceptor is used to intercept all requests
 * and add a JWT token if it exists into the request. It will
 * attempt to refresh the token if it expires.
 */
@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor {

    isRefreshingToken = false;
    refreshTokenSubj = new BehaviorSubject<any>(null);

    constructor(
        private auth: AuthenticationService,
        private store: Store<State>,
        private router: Router,
    ) {}


    handleResponseError(request: HttpRequest<any>, next: HttpHandler) {

        if (!this.isRefreshingToken) {
            this.isRefreshingToken = true;
            this.refreshTokenSubj.next(null);
            return this.auth.refresh().pipe(
                switchMap((token) => {
                    this.isRefreshingToken = false;
                    this.refreshTokenSubj.next(token.accessToken.token);
                    return next.handle(this.addAuthHeader(request));
                }),
                catchError((err) => {
                    // Refresh token invalid or could not fetch
                    this.isRefreshingToken = false;
                    this.auth.logout();
                    this.store.dispatch(AuthActions.loginReset());
                    this.store.dispatch(SnackbarActions.displaySnackbar({payload: {
                        message: 'Session Expired. Please login again.',
                        action: 'Dismiss',
                        config: { duration: 10000 },
                    }}));
                    this.router.navigate(['/login']);
                    return throwError(err);
                })
            );
        } else {
            return this.refreshTokenSubj.pipe(
                filter(token => token != null),
                take(1),
                switchMap(() => next.handle(this.addAuthHeader(request)))
            );
        }
    }


    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
      if (environment.oauthEnabled) {
        // Our angular-oauth2-oidc config should be intercepting any `/api` calls automatically, so when OAuth is enabled we can safely
        // do nothing with the request.
        return next.handle(req);
      } else {
        req = this.addAuthHeader(req);
        return next.handle(req).pipe(
            catchError(error => {
                if (error instanceof HttpErrorResponse && error.status === 401 && !(req.url.endsWith('/refresh'))) {
                    return this.handleResponseError(req, next);
                } else {
                    return throwError(error);
                }
            })
        );
      }
    }

    /**
     * Allow auth header to be updated with new access jwt
     * @param request - request with auth header you're trying to modify
     */
    addAuthHeader(request: HttpRequest<any>) {
        const authHeader = this.auth.getAuthHeader();
        if (authHeader) {
            return request.clone({
                setHeaders: {
                    Authorization: authHeader,
                }
            });
        } else {
            return request;
        }
    }
}
