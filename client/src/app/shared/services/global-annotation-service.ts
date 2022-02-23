import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { GlobalAnnotationListItem } from 'app/interfaces/annotation';

import { PaginatedRequestOptions, ResultList } from '../schemas/common';

@Injectable({providedIn: 'root'})
export class GlobalAnnotationService {
    readonly baseUrl = '/api/annotations';

    constructor(private http: HttpClient) { }

    getAnnotations(options: PaginatedRequestOptions = {}, globalAnnotationType: string): Observable<ResultList<GlobalAnnotationListItem>> {
        return this.http.get<ResultList<GlobalAnnotationListItem>>(
            `${this.baseUrl}/global-list`, {
            params: {...options as any, globalAnnotationType},
            }
        );
    }

    deleteAnnotations(pids: number[][]): Observable<string> {
        return this.http.request<{result: string}>(
            'DELETE',
            `${this.baseUrl}/global-list`,
            {
              headers: { 'Content-Type': 'application/json' },
              body: {
                pids,
              },
              responseType: 'json',
            }
        ).pipe(map(res => res.result));
    }

    exportGlobalExclusions(): Observable<HttpEvent<Blob>> {
        return this.http.get(
            `${this.baseUrl}/global-list/exclusions`, {
            responseType: 'blob',
            observe: 'events',
            reportProgress: true,
        });
    }

    exportGlobalInclusions(): Observable<HttpEvent<Blob>> {
        return this.http.get(
            `${this.baseUrl}/global-list/inclusions`, {
            responseType: 'blob',
            observe: 'events',
            reportProgress: true,
            }
        );
    }
}
