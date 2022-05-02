import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';

import { FTSResult } from 'app/interfaces';

@Injectable()
export class GraphSearchService {
  readonly searchApi = '/api/search';

  constructor(private http: HttpClient) { }

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
    ).pipe(map(resp => resp.result));
  }
}
