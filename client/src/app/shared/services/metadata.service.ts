import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { BuildInfo } from 'app/interfaces/metadata.interface';
import { AuthenticationService } from 'app/auth/services/authentication.service';

import { AbstractService } from './abstract-service';

@Injectable({providedIn: 'root'})
export class MetaDataService extends AbstractService {
    readonly baseUrl = '/api/meta';

    constructor(auth: AuthenticationService, http: HttpClient) {
        super(auth, http);
    }

    getBuildInfo(): Observable<BuildInfo> {
        return this.http.get<{result: BuildInfo}>(
            `${this.baseUrl}/`,
            {...this.getHttpOptions(true)}
        ).pipe(
            map((res) => res.result)
        );
    }
}
