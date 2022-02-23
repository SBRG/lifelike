import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';


import { KeycloakUserData } from '../interfaces';

@Injectable()
export class KeycloakAccountService {

  // NOTE: Make sure the Keycloak account api base path is included in the `allowedUrls` property of the OAuthModuleConfig object in
  // the auth-module-config file. Otherwise the Keycloak access token won't be added automatically to the headers of these requests.
  private keycloakAccountApiPath = 'https://keycloak.apps.lifelike.cloud/auth/realms/master/account';

  constructor(
    private http: HttpClient,
  ) {}

  getCurrentUser(): Observable<KeycloakUserData> {
    return this.http.get<KeycloakUserData>(`${this.keycloakAccountApiPath}`);
  }

  updateCurrentUser(update: KeycloakUserData) {
    return this.http.post(`${this.keycloakAccountApiPath}`, update);
  }
}
