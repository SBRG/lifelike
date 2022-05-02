import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { ModuleAwareComponent } from 'app/shared/modules';

/**
 * Endpoints to manage with the filesystem exposed to the user.
 */
@Injectable({providedIn: 'root'})
export class ViewService {
  constructor(protected readonly http: HttpClient) {}

  get(viewId: string): Observable<object> {
    return this.http.get(
      `/api/view/${encodeURIComponent(viewId)}`,
    );
  }

  /**
   * Given set of params saves them in DB and returns row UUID
   * @param params arbitrary JSON parsable object
   */
  create(params: object) {
    return this.http.post(
      `/api/view/`, params,
      {
        responseType: 'text'
      }
    );
  }

  getShareableLink(componentInstance: ModuleAwareComponent, url: string): Observable<URL> {
    const hashUrl = new URL(url.replace(/^\/+/, '/'), window.location.href);
    const viewParams = (componentInstance || {}).viewParams;
    if (viewParams) {
      return this.create(viewParams).pipe(
        map(viewId => {
          if (viewId) {
            hashUrl.hash = viewId;
          }
          return hashUrl;
        })
      );
    }
    return of(hashUrl);
  }
}
