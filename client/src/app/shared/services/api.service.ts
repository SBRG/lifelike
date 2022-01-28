import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { AuthenticationService } from 'app/auth/services/authentication.service';

import { AbstractService, ServiceCallOptions } from './abstract-service';

@Injectable()
export class ApiService extends AbstractService {
  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  public getHttpOptions(authenticated = false, options: ServiceCallOptions = {}) {
    return super.getHttpOptions(...arguments);
  }
}
