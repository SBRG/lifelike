import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse, HttpEvent } from '@angular/common/http';

import { Observable } from 'rxjs';

@Injectable({providedIn: 'root'})
export class StorageService {
    readonly baseUrl = '/api/storage';

    constructor(private http: HttpClient) { }

    getUserManual(): Observable<HttpResponse<Blob>> {
        return this.http.get(
            `${this.baseUrl}/manual`, {
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
                observe: 'events',
                reportProgress: true
            });
    }
}
