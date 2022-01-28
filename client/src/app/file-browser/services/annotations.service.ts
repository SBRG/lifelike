import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiService } from 'app/shared/services/api.service';
import { ResultList, ResultMapping } from 'app/shared/schemas/common';
import { Annotation } from 'app/pdf-viewer/annotation-type';
import {
  SortingAlgorithmId
} from 'app/word-cloud/sorting/sorting-algorithms';

import {
  AnnotationExclusionCreateRequest,
  AnnotationExclusionDeleteRequest,
  PDFAnnotationGenerationRequest,
  AnnotationGenerationResultData,
  CustomAnnotationCreateRequest,
  CustomAnnotationDeleteRequest,
} from '../schema';

@Injectable()
export class AnnotationsService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  getAnnotations(hashId: string): Observable<Annotation[]> {
    return this.http.get<ResultList<Annotation>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations`,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => data.results),
    );
  }

  getSortedAnnotations(hashId: string, sort: SortingAlgorithmId) {
    return this.http.post(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/sorted`, {}, {
        ...this.apiService.getHttpOptions(true),
        params: {sort},
        responseType: 'text',
      },
    );
  }

  generateAnnotations(hashIds: string[], request: PDFAnnotationGenerationRequest = {}):
    Observable<ResultMapping<AnnotationGenerationResultData>> {
    return this.http.post<ResultMapping<AnnotationGenerationResultData>>(
      `/api/filesystem/annotations/generate`, {
        hashIds,
        ...request,
      },
      this.apiService.getHttpOptions(true),
    );
  }

  addCustomAnnotation(hashId: string, request: CustomAnnotationCreateRequest): Observable<Annotation[]> {
    return this.http.post<ResultList<Annotation>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/custom`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(data => data.results),
    );
  }

  removeCustomAnnotation(hashId: string, uuid: string, request: CustomAnnotationDeleteRequest): Observable<string[]> {
    return this.http.request<ResultList<string>>(
      'DELETE',
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/custom/${encodeURIComponent(uuid)}`, {
        ...this.apiService.getHttpOptions(true, {
          contentType: 'application/json',
        }),
        body: request,
        responseType: 'json',
      },
    ).pipe(
      map(data => data.results),
    );
  }

  addAnnotationExclusion(hashId: string, request: AnnotationExclusionCreateRequest): Observable<{}> {
    return this.http.post<{}>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/exclusions`,
      request,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(() => ({}))
    );
  }

  removeAnnotationExclusion(hashId: string, request: AnnotationExclusionDeleteRequest): Observable<{}> {
    return this.http.request<{}>(
      'DELETE',
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/exclusions`, {
        ...this.apiService.getHttpOptions(true, {
          contentType: 'application/json',
        }),
        body: request,
        responseType: 'json',
      },
    ).pipe(
      map(() => ({}))
    );
  }

}
