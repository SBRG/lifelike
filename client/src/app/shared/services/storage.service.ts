import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse, HttpEvent } from '@angular/common/http';

import { Observable } from 'rxjs';

import { AuthenticationService } from 'app/auth/services/authentication.service';

import { AbstractService } from './abstract-service';

@Injectable({providedIn: 'root'})
export class StorageService extends AbstractService {
    readonly baseUrl = '/api/storage';

    constructor(auth: AuthenticationService, http: HttpClient) {
        super(auth, http);
    }

    getUserManual(): Observable<HttpResponse<Blob>> {
        return this.http.get(
            `${this.baseUrl}/manual`, {
            ...this.getHttpOptions(true),
            responseType: 'blob',
            observe: 'response',
        });
    }

    uploadUserManual(file: File): Observable<HttpEvent<{result: string}>> {
        const formData: FormData = new FormData();
        formData.append('file', file);
        return this.http.post<{result: string}>(
            `${this.baseUrl}/manual`,
            formData,
            {
                ...this.getHttpOptions(true),
                observe: 'events',
                reportProgress: true
            });
    }
}
