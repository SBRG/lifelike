import { HttpClient, HttpHeaders } from '@angular/common/http';

import { AuthenticationService } from 'app/auth/services/authentication.service';

/**
 * @deprecated Angular makes inheritance very difficult so use ApiService (see FilesystemService)
 */
export abstract class AbstractService {
  constructor(
    readonly auth: AuthenticationService,
    readonly http: HttpClient,
  ) {
  }

  /**
   * @deprecated Angular makes inheritance very difficult so use ApiService (see FilesystemService)
   */
  protected getHttpOptions(authenticated = false, options: ServiceCallOptions = {}) {
    const headers: { [k: string]: string } = {};

    if (options.contentType != null) {
      headers['Content-Type'] = options.contentType;
    }

    if (authenticated) {
      headers.Authorization = `Bearer ${this.auth.getAccessToken()}`;
    }

    return {
      headers: new HttpHeaders(headers),
    };
  }
}

export interface ServiceCallOptions {
  contentType?: string;
}
