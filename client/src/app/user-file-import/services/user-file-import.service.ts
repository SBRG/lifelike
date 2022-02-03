import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthenticationService } from 'app/auth/services/authentication.service';
import { AbstractService } from 'app/shared/services/abstract-service';
import { FileNameAndSheets, Neo4jColumnMapping } from 'app/interfaces/user-file-import.interface';

@Injectable()
export class UserFileImportService extends AbstractService {
    readonly neo4jAPI = '/api/user-file-import';

    constructor(auth: AuthenticationService, http: HttpClient) {
        super(auth, http);
    }

    getDbLabels(): Observable<string[]> {
        return this.http.get<{result: string[]}>(
            `${this.neo4jAPI}/get-db-labels`,
            {...this.getHttpOptions(true)}
            ).pipe(map(resp => resp.result));
    }

    getDbRelationshipTypes(): Observable<string[]> {
        return this.http.get<{result: string[]}>(
            `${this.neo4jAPI}/get-db-relationship-types`,
            {...this.getHttpOptions(true)}
            ).pipe(map(resp => resp.result));
    }

    getNodeProperties(nodeLabel): Observable<{ [key: string]: string[] }> {
        return this.http.get<{result: { [key: string]: string[] }}>(
            `${this.neo4jAPI}/get-node-properties`,
            {...this.getHttpOptions(true), params: new HttpParams().set('nodeLabel', nodeLabel)},
        ).pipe(map(resp => resp.result));
    }

    uploadExperimentalDataFile(file: FormData): Observable<FileNameAndSheets> {
        return this.http.post<{result: FileNameAndSheets}>(
            `${this.neo4jAPI}/upload-file`,
            file,
            {...this.getHttpOptions(true)}
            ).pipe(map(resp => resp.result));
    }

    uploadNodeMapping(mappings: Neo4jColumnMapping): Observable<any> {
        return this.http.post<{result: any}>(
            `${this.neo4jAPI}/upload-node-mapping`,
            mappings,
            {...this.getHttpOptions(true)}
            ).pipe(map(resp => resp.result));
    }
}
