import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from 'app/shared/services/abstract-service';

@Injectable({providedIn: 'root'})
export class KgImportService extends AbstractService {
    readonly importApi = '/api/user-file-import';

    constructor(auth: AuthenticationService, http: HttpClient) {
        super(auth, http);
    }

    importGeneRelationships(data: FormData): Observable<any> {
        return this.http.post<{result: any}>(
            `${this.importApi}/import-genes`,
            data,
        ).pipe(map(resp => resp.result));
    }
}
