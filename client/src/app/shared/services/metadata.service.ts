import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BuildInfo } from 'app/interfaces/metadata.interface';

@Injectable({providedIn: 'root'})
export class MetaDataService {
    readonly baseUrl = '/api/meta';

    constructor(private http: HttpClient) { }

    getBuildInfo(): Observable<BuildInfo> {
        return this.http.get<{result: BuildInfo}>(
            `${this.baseUrl}/`,
        ).pipe(
            map((res) => res.result)
        );
    }
}
