import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';

import { ApiService } from 'app/shared/services/api.service';
import {
  PaginatedRequestOptions,
  ResultList,
  ResultMapping,
  SingleResult,
} from 'app/shared/schemas/common';
import { ModelList } from 'app/shared/models';
import { serializePaginatedParams } from 'app/shared/utils/params';

import { ProjectList } from '../models/project-list';
import { ProjectImpl } from '../models/filesystem-object';
import {
  BulkProjectUpdateRequest,
  CollaboratorData,
  MultiCollaboratorUpdateRequest,
  ProjectCreateRequest,
  ProjectData,
  ProjectSearchRequest,
} from '../schema';
import { encode } from 'punycode';
import { Collaborator } from '../models/collaborator';

@Injectable()
export class ProjectsService {

  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  list(options?: PaginatedRequestOptions): Observable<ProjectList> {
    return this.http.get<ResultList<ProjectData>>(
      `/api/projects/projects`, {
        ...this.apiService.getHttpOptions(true),
        params: serializePaginatedParams(options, false),
      },
    ).pipe(
      map(data => {
        const projectList = new ProjectList();
        projectList.collectionSize = data.total;
        projectList.results.replace(data.results.map(
          itemData => new ProjectImpl().update(itemData)));
        return projectList;
      }),
    );
  }

  search(options: ProjectSearchRequest): Observable<ProjectList> {
    return this.http.post<ResultList<ProjectData>>(
      `/api/projects/search`,
      options,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const projectList = new ProjectList();
        projectList.collectionSize = data.total;
        projectList.results.replace(data.results.map(
          itemData => new ProjectImpl().update(itemData)));
        return projectList;
      }),
    );
  }

  create(request: ProjectCreateRequest) {
    return this.http.post<SingleResult<ProjectData>>(
      `/api/projects/projects`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => new ProjectImpl().update(data.result)),
    );
  }

  get(hashId: string): Observable<ProjectImpl> {
    return this.http.get<SingleResult<ProjectData>>(
      `/api/projects/projects/${encode(hashId)}`,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => new ProjectImpl().update(data.result)),
    );
  }

  save(hashIds: string[], changes: Partial<BulkProjectUpdateRequest>,
       updateWithLatest?: { [hashId: string]: ProjectImpl }):
    Observable<{ [hashId: string]: ProjectImpl }> {
    return this.http.patch<ResultMapping<ProjectData>>(
      `/api/projects/projects`, {
        ...changes,
        hashIds,
      }, this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const ret: { [hashId: string]: ProjectImpl } = updateWithLatest || {};
        for (const [itemHashId, itemData] of Object.entries(data.mapping)) {
          if (!(itemHashId in ret)) {
            ret[itemHashId] = new ProjectImpl();
          }
          ret[itemHashId].update(itemData);
        }
        return ret;
      }),
    );
  }

  getCollaborators(hashId: string, options: PaginatedRequestOptions = {}):
    Observable<ModelList<Collaborator>> {
    return this.http.get<ResultList<CollaboratorData>>(
      `/api/projects/projects/${hashId}/collaborators`, {
        ...this.apiService.getHttpOptions(true),
        params: serializePaginatedParams(options, false),
      },
    ).pipe(
      map(data => {
        const collaboratorsList = new ModelList<Collaborator>();
        collaboratorsList.collectionSize = data.results.length;
        collaboratorsList.results.replace(data.results.map(
          itemData => new Collaborator().update(itemData)));
        return collaboratorsList;
      }),
    );
  }

  saveCollaborators(hashId: string, request: MultiCollaboratorUpdateRequest):
    Observable<ModelList<Collaborator>> {
    return this.http.post<ResultList<CollaboratorData>>(
      `/api/projects/projects/${hashId}/collaborators`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => {
        const collaboratorsList = new ModelList<Collaborator>();
        collaboratorsList.collectionSize = data.results.length;
        collaboratorsList.results.replace(data.results.map(
          itemData => new Collaborator().update(itemData)));
        return collaboratorsList;
      }),
    );
  }

}
