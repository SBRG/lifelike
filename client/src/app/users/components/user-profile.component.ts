import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';

import { select, Store } from '@ngrx/store';

import { AppUser, UserUpdateData } from 'app/interfaces';
import { State } from 'app/root-store';
import { AuthActions, AuthSelectors } from 'app/auth/store';

import { KeycloakAccountService } from '../services/keycloak-account.service';
import { KeycloakUserData } from '../interfaces';
import { environment } from '../../../environments/environment';


@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class UserProfileComponent implements OnInit  {

  currentUser: AppUser;
  keycloakUserData: KeycloakUserData;

  form: FormGroup;

  constructor(
    private readonly keycloakAccountService: KeycloakAccountService,
    private store$: Store<State>) {
  }

  ngOnInit() {
    this.store$.pipe(select(AuthSelectors.selectAuthUser)).subscribe(user => {
      this.currentUser = user;
      this.form = new FormGroup({
        username: new FormControl(user.username, Validators.required),
        firstName: new FormControl(user.firstName, Validators.required),
        lastName: new FormControl(user.lastName, Validators.required),
        email: new FormControl({value: user.email, disabled: true}, Validators.required),
      });
    });

    if (environment.oauthEnabled) {
      this.keycloakAccountService.getCurrentUser().subscribe(keycloakUserData => this.keycloakUserData = keycloakUserData);
    }
  }

  getLifelikeUserUpdateData(): UserUpdateData {
    return this.form.value;
  }

  getKeycloakUserUpdateData(): KeycloakUserData {
    return { ...this.keycloakUserData, ...this.form.value };
  }

  submit() {
    if (environment.oauthEnabled) {
      this.store$.dispatch(AuthActions.updateOAuthUser({
        userUpdateData: this.getKeycloakUserUpdateData(),
      }));
    } else {
      this.store$.dispatch(AuthActions.updateUser({
        userUpdateData: this.getLifelikeUserUpdateData(),
        hashId: this.currentUser.hashId
      }));
    }
  }
}
