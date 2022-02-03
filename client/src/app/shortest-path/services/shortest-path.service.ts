import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from 'app/shared/services/abstract-service';

@Injectable({
  providedIn: 'root'
})
export class ShortestPathService extends AbstractService {
  readonly kgAPI = '/api/knowledge-graph';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  getShortestPathQueryResult(queryId: number): Observable<any> {
    return this.http.get<{result: any}>(
      `${this.kgAPI}/shortest-path-query/${queryId}`, {
        ...this.getHttpOptions(true),
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getShortestPathQueryList(): Observable<any> {
    return this.http.get<{result: Map<number, string>}>(
      `${this.kgAPI}/shortest-path-query-list`, {
        ...this.getHttpOptions(true),
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }
}
