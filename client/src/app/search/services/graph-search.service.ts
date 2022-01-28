import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import { FTSResult } from 'app/interfaces';
import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from 'app/shared/services/abstract-service';

@Injectable()
export class GraphSearchService extends AbstractService {
  readonly searchApi = '/api/search';

  constructor(auth: AuthenticationService, http: HttpClient) {
    super(auth, http);
  }

  visualizerSearch(
      query: string,
      organism: string = '',
      page: number = 1,
      limit: number = 10,
      domains: string[],
      entities: string[],
  ) {
    return this.http.post<{ result: FTSResult }>(
      `${this.searchApi}/viz-search`,
      {query, organism, page, domains, entities, limit},
      {...this.getHttpOptions(true)}
    ).pipe(map(resp => resp.result));
  }
}
