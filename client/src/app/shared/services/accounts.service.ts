import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AppUser } from 'app/interfaces';

import { ApiService } from './api.service';
import { ResultList } from '../schemas/common';
import { ModelList } from '../models';
import { AccountSearchRequest } from '../schema/accounts';

@Injectable()
export class AccountsService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  search(options: AccountSearchRequest): Observable<ModelList<AppUser>> {
    return this.http.post<ResultList<AppUser>>(
      `/api/accounts/search`,
      options,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const list = new ModelList<AppUser>();
        list.results.replace(data.results);
        return list;
      }),
    );
  }

}
