import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiService } from 'app/shared/services/api.service';
import { TextAnnotationGenerationRequest } from 'app/file-browser/schema';

import { EnrichmentParsedData } from '../models/enrichment-document';

@Injectable()
export class EnrichmentTableService {
  constructor(protected readonly http: HttpClient,
              protected readonly apiService: ApiService) {
  }

  /**
   * Match gene names to NCBI nodes with same name and has given taxonomy ID.
   * @param geneNames list of input gene names to match to
   * @param organism tax id of organism
   */
  matchNCBINodes(geneNames: string[], organism: string): Observable<NCBIWrapper[]> {
    return this.http.post<{ result: NCBIWrapper[] }>(
      '/api/enrichment-table/match-ncbi-nodes',
      {geneNames, organism},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map((resp: any) => resp.result),
    );
  }

  /**
   * Match enrichment domains to given node ids.
   * @param nodeIds list of node ids to match to enrichment domains
   * @param taxID tax id of organism
   */
  getNCBIEnrichmentDomains(nodeIds, taxID: string, domains: string[]): Observable<EnrichmentWrapper> {
    return this.http.post<{result: EnrichmentWrapper}>(
      `/api/knowledge-graph/get-ncbi-nodes/enrichment-domains`,
      {nodeIds, taxID, domains},
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(resp => resp.result),
    );
  }

  annotateEnrichment(hashIds: string[], request: TextAnnotationGenerationRequest): Observable<any> {
    return this.http.post(
      `/api/filesystem/annotations/generate`,
      {hashIds, ...request},
      this.apiService.getHttpOptions(true)
    ).pipe(
      map((resp: any) => resp.results)
    );
  }

  refreshEnrichmentAnnotations(hashIds: string[]): Observable<any> {
    return this.http.post(
      `/api/filesystem/annotations/refresh`,
      {hashIds},
      this.apiService.getHttpOptions(true)
    ).pipe(
      map((resp: any) => resp.results)
    );
  }

  getAnnotatedEnrichment(hashId: string): Observable<EnrichmentParsedData> {
    return this.http.get<{results: EnrichmentParsedData}>(
      `/api/filesystem/objects/${encodeURIComponent(hashId)}/enrichment/annotations`,
      this.apiService.getHttpOptions(true),
    ).pipe(
      map(resp => resp.results),
    );
  }
}


export interface Worksheet {
  id: number;
  filename: string;
  sheetname: string;
  neo4jNodeId: number;
  creationDate: string;
  modifiedDate: string;
  contentID: number;
}

export interface NCBINode {
  full_name: string;
  name: string;
}

export interface NCBIWrapper {
  geneNeo4jId: number;
  synonymNeo4jId: number;
  gene: NCBINode;
  link: string;
  synonym: string;
}

interface BiocycWrapper {
  link: string;
  result: string[] | null;
}

interface GoWrapper {
  link: string;
  result: string[];
}

interface RegulonWrapper {
  link: string;
  result: RegulonNode;
}

export interface RegulonNode {
  right_end_position: number;
  left_end_position: number;
  name: string;
  regulondb_id: string;
  strand: string;
  regulator_family: string;
  repressed_by: string[];
  activated_by: string[];
}

interface StringWrapper {
  link: string;
  result: StringNode;
}

export interface StringNode {
  annotation: string;
  id: string;
}

interface UniprotWrapper {
  link: string;
  result: UniprotNode;
}

export interface UniprotNode {
  function: string;
  id: string;
}

interface KeggWrapper {
  result: string[];
  link: string;
}

export interface DomainWrapper {
  biocyc: BiocycWrapper | null;
  go: GoWrapper | null;
  regulon: RegulonWrapper | null;
  string: StringWrapper | null;
  uniprot: UniprotWrapper | null;
  kegg: KeggWrapper | null;
  node_id: number;
}

export interface EnrichmentWrapper {
  [id: number]: DomainWrapper;
}
