import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

import { OrganismAutocomplete, OrganismsResult } from 'app/interfaces';

import { ApiService } from './api.service';

@Injectable()
export class SharedSearchService {
  readonly searchApi = '/api/search';

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  getOrganismFromTaxId(organismTaxId: string): Observable<OrganismAutocomplete> {
    return this.http.get<{ result: OrganismAutocomplete }>(
      `${this.searchApi}/organism/${organismTaxId}`,
      this.apiService.getHttpOptions(true),
    ).pipe(map(resp => resp.result));
  }

  getOrganisms(query: string, limit: number = 50): Observable<OrganismsResult> {
    return this.http.post<{ result: OrganismsResult }>(
      `${this.searchApi}/organisms`,
      {query, limit},
      this.apiService.getHttpOptions(true),
    ).pipe(map(resp => resp.result));
  }
}
