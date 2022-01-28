import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { GlobalAnnotationListItem } from 'app/interfaces/annotation';

import { AbstractService } from './abstract-service';
import { PaginatedRequestOptions, ResultList } from '../schemas/common';
import { ApiService } from './api.service';

@Injectable({providedIn: 'root'})
export class GlobalAnnotationService extends AbstractService {
    readonly baseUrl = '/api/annotations';

    constructor(
        auth: AuthenticationService,
        http: HttpClient,
        protected readonly apiService: ApiService
    ) {
        super(auth, http);
    }

    getAnnotations(options: PaginatedRequestOptions = {}, globalAnnotationType: string): Observable<ResultList<GlobalAnnotationListItem>> {
        return this.http.get<ResultList<GlobalAnnotationListItem>>(
            `${this.baseUrl}/global-list`, {
            ...this.getHttpOptions(true),
            params: {...options as any, globalAnnotationType},
            }
        );
    }

    deleteAnnotations(pids: number[][]): Observable<string> {
        return this.http.request<{result: string}>(
            'DELETE',
            `${this.baseUrl}/global-list`,
            {...this.apiService.getHttpOptions(true, {
                contentType: 'application/json',
              }),
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
            ...this.getHttpOptions(true),
            responseType: 'blob',
            observe: 'events',
            reportProgress: true,
        });
    }

    exportGlobalInclusions(): Observable<HttpEvent<Blob>> {
        return this.http.get(
            `${this.baseUrl}/global-list/inclusions`, {
            ...this.getHttpOptions(true),
            responseType: 'blob',
            observe: 'events',
            reportProgress: true,
            }
        );
    }
}
