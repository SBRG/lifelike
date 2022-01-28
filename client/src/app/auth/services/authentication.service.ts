import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { isNil } from 'lodash-es';
import { Observable, of, timer, Subscription } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { JWTTokenResponse } from 'app/interfaces';


@Injectable({providedIn: 'root'})
export class AuthenticationService implements OnDestroy {
  readonly baseUrl = '/api/auth';

  private refreshSubscription: Subscription;

  constructor(private http: HttpClient) { }

  ngOnDestroy() {
    this.refreshSubscription.unsubscribe();
  }

  getAuthHeader(): string | void {
    const token = localStorage.getItem('access_jwt');
    if (token) {
      return `Bearer ${token}`;
    }
  }

  public isAuthenticated(): boolean {
    const expirationTime = new Date(localStorage.getItem('expires_at')).getTime();
    const currentTime = new Date().getTime();
    return currentTime < expirationTime;
  }

  public scheduleRenewal() {
    if (!this.isAuthenticated()) {
      return;
    }
    const expirationTime = new Date(localStorage.getItem('expires_at')).getTime();
    const source = of(expirationTime).pipe(mergeMap((expiresAt) => {
      const now = new Date().getTime();
      const refreshAt = expiresAt - (1000 * 60);
      return timer(Math.max(1, refreshAt - now)).pipe(
        mergeMap(() => this.refresh()));
    }));

    this.refreshSubscription = source.subscribe(() => {});
  }

  /**
   * Authenticate users to get a JWT
   */
  public login(email: string, password: string): Observable<JWTTokenResponse> {
    return this.http.post<JWTTokenResponse>(
      this.baseUrl + '/login',
      {email, password},
    ).pipe(
      map((resp: JWTTokenResponse) => {
        localStorage.setItem('authId', resp.user.id.toString());
        localStorage.setItem('access_jwt', resp.accessToken.token);
        localStorage.setItem('expires_at', resp.accessToken.exp);
        // TODO: Move this out of localStorage
        localStorage.setItem('refresh_jwt', resp.refreshToken.token);
        this.scheduleRenewal();
        return resp;
      })
    );
  }

  /**
   * Logout user and return to logout page ..
   * whle removing refresh and access jwt
   */
  public logout() {
    localStorage.removeItem('refresh_jwt');
    localStorage.removeItem('access_jwt');
    localStorage.removeItem('expires_at');
    // See root-store module where this is set
    localStorage.removeItem('authId');
  }

  /**
   * Renew user access token with their refresh token
   */
  public refresh() {
    const jwt = localStorage.getItem('refresh_jwt');
    return this.http.post<JWTTokenResponse>(
      this.baseUrl + '/refresh',
      { jwt },
    ).pipe(
        map((resp) => {
          localStorage.setItem('access_jwt', resp.accessToken.token);
          localStorage.setItem('expires_at', resp.accessToken.exp);
          // TODO: Remove refresh token from localStorage
          localStorage.setItem('refresh_jwt', resp.refreshToken.token);
          this.scheduleRenewal();
          return resp;
        }),
      );
  }

  public whoAmI(): number {
    const authId = JSON.parse(localStorage.getItem('authId'));

    if (
      isNil(authId)
    ) { return; }

    return authId;
  }

  public getAccessToken() {
    return localStorage.getItem('access_jwt') || '';
  }

  /**
   * Write cookie to system
   * @param name - represent id name of cookie
   * @param value - value for cookie to store
   * @param days - how long should cookie exist
   */
  setCookie(name, value, days= 30) {
    let expires = '';
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + (value || '')  + expires + '; path=/';
  }
  getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') { c = c.substring(1, c.length); }
        if (c.indexOf(nameEQ) === 0) { return c.substring(nameEQ.length, c.length); }
    }
    return null;
  }
  eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999;';
  }
}
