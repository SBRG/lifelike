import { Injectable } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    CanActivate,
    RouterStateSnapshot,
} from '@angular/router';

import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';

import { State } from '../store/state';
import { AuthActions, AuthSelectors } from '../store';
import { LifelikeOAuthService } from '../services/oauth.service';
import { environment } from '../../../environments/environment';

export type AuthGroups = 'SELF' | 'USER' | 'ADMIN';

@Injectable()
export class LifelikeAuthGuard implements CanActivate {

    activatedRoute: ActivatedRouteSnapshot;
    redirectUrl: string;

    constructor(
      private store: Store<State>,
      private oauthService: LifelikeOAuthService,
    ) {}

    canActivate(active: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
        this.activatedRoute = active;
        this.redirectUrl = state.url;
        const group: AuthGroups = active.data.group || 'USER';
        return this.hasRequiredPermission(group);
    }

    /**
     * hasRequiredPermission is used for permission checks when
     * routing. The current permission scheme uses groups
     * such as 'USER', 'SELF' and 'ADMIN' which all have
     * particular permissions associated.
     */
    protected hasRequiredPermission(authGroup: AuthGroups) {
        return this.store.pipe(
            select(AuthSelectors.selectAuthLoginStateAndUser),
            map(({loggedIn, user}) => {
                if (loggedIn) {
                    // If the route guard requires the user to match self
                    // (e.g. logged in user to see their own profile)
                    if (authGroup === 'SELF') {
                        return this.activatedRoute.params.user === user.username;
                    }
                    return true;
                }
                if (environment.oauthEnabled) {
                  this.oauthService.login(this.redirectUrl);
                } else {
                  this.store.dispatch(AuthActions.loginRedirect({url: this.redirectUrl}));
                }
                return false; // Note that this return is probably redundant when oauth is enabled, since we redirect out of the app anyway
            }),
            take(1),
        );
    }
}
