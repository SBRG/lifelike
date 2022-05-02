import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ShortestPathService {
  readonly kgAPI = '/api/knowledge-graph';

  constructor(private http: HttpClient) { }

  getShortestPathQueryResult(queryId: number): Observable<any> {
    return this.http.get<{result: any}>(
      `${this.kgAPI}/shortest-path-query/${queryId}`, {
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  getShortestPathQueryList(): Observable<any> {
    return this.http.get<{result: Map<number, string>}>(
      `${this.kgAPI}/shortest-path-query-list`, {
      }
    ).pipe(
      map((resp: any) => resp.result),
    );
  }
}
