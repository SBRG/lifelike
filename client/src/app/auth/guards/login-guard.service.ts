import { Injectable } from '@angular/core';
import {
    CanActivate,
    ActivatedRouteSnapshot,
    Router,
    RouterStateSnapshot,
} from '@angular/router';

import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { State } from '../store/state';
import { AuthSelectors } from '../store';

/**
 * Check if the user is already logged in when they access login page,
 * redirect to home if yes.
 */

@Injectable()
export class LoginGuard implements CanActivate {
  constructor(private store: Store<State>, private router: Router) {}

  canActivate(
    {}: ActivatedRouteSnapshot,
    {}: RouterStateSnapshot,
  ): Observable<boolean> {
    return this.store.pipe(
      select(AuthSelectors.selectAuthLoginState),
      map(loggedIn => {
        if (loggedIn) {
          this.router.navigate(['/']);
          return false;
        }
        return true;
      }),
      take(1)
    );
  }
}
