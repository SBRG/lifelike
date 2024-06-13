import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  constructor(protected readonly http: HttpClient) {}

  getAnnotations(hashId: string): Observable<Annotation[]> {
    return this.http.get<ResultList<Annotation>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations`,
    ).pipe(
      map(data => data.results),
    );
  }

  getSortedAnnotations(hashId: string, sort: SortingAlgorithmId) {
    return this.http.post(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/sorted`, {}, {
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
    );
  }

  addCustomAnnotation(hashId: string, request: CustomAnnotationCreateRequest): Observable<Annotation[]> {
    return this.http.post<ResultList<Annotation>>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/custom`,
      request,
    ).pipe(
      map(data => data.results),
    );
  }

  removeCustomAnnotation(hashId: string, uuid: string, request: CustomAnnotationDeleteRequest): Observable<string[]> {
    return this.http.request<ResultList<string>>(
      'DELETE',
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/custom/${encodeURIComponent(uuid)}`, {
        headers: {'Content-Type': 'application/json'},
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
    ).pipe(
      map(() => ({}))
    );
  }

  removeAnnotationExclusion(hashId: string, request: AnnotationExclusionDeleteRequest): Observable<{}> {
    return this.http.request<{}>(
      'DELETE',
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/annotations/exclusions`, {
        headers: {'Content-Type': 'application/json'},
        body: request,
        responseType: 'json',
      },
    ).pipe(
      map(() => ({}))
    );
  }

}
