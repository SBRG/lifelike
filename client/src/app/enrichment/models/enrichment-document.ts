import { Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';

import { mapBlobToBuffer } from 'app/shared/utils/files';
import { nullCoalesce } from 'app/shared/utils/types';
import { TextAnnotationGenerationRequest } from 'app/file-browser/schema';

import { DomainWrapper, EnrichmentTableService, EnrichmentWrapper, NCBINode, NCBIWrapper, } from '../services/enrichment-table.service';


export class BaseEnrichmentDocument {
  taxID = '';
  organism = '';
  importGenes: string[] = [];
  domains: string[] = [
    'Regulon',
    'UniProt',
    'String',
    'GO',
    'BioCyc',
    'KEGG'
  ];
  result: EnrichmentResult = null;
  duplicateGenes: string[] = [];
  fileId = '';

  parseParameters({
                    importGenes,
                    taxID,
                    organism,
                    domains,
                    ...rest
                  }: EnrichmentParsedData) {
    // parse the file content to get gene list and organism tax id and name
    const rawImportGenes = importGenes.map(gene => gene.trim()).filter((gene) => gene !== '');
    if (taxID === '562' || taxID === '83333') {
      taxID = '511145';
    } else if (taxID === '4932') {
      taxID = '559292';
    }

    // parse for column order/domain input
    if (domains == null) {
      domains = this.domains;
    }

    const duplicateGenes = this.getDuplicates(rawImportGenes);

    // We set these all at the end to be thread/async-safe
    return {
      importGenes: rawImportGenes,
      taxID,
      organism,
      domains,
      duplicateGenes,
      ...rest
    };
  }

  setParameters(params) {
    // We set these all at the end to be thread/async-safe
    const parsedParams = this.parseParameters(params);
    Object.assign(this, parsedParams);
    return parsedParams;
  }

  /**
   * Remove any duplicates from the import gene list and populate duplicate list
   * @param arr string of gene names
   */
  private getDuplicates(arr: string[]): string[] {
    const duplicateArray = new Set<string>();
    const uniqueArray = new Set<string>();
    for (const item of arr) {
      if (uniqueArray.has(item)) {
        duplicateArray.add(item);
      } else {
        uniqueArray.add(item);
      }
    }
    return Array.from(duplicateArray);
  }

  load(blob: Blob): Observable<EnrichmentParsedData> {
    return of(blob)
      .pipe(
        mapBlobToBuffer(),
        map((data: ArrayBuffer | undefined): EnrichmentData => {
          if (data == null) {
            return null;
          }
          const s = new TextDecoder('utf-8').decode(data);
          try {
            return JSON.parse(s) as EnrichmentData;
          } catch (e) {
            // Old enrichment table format was just a string for the data
            const split = s.split('/');
            return {
              data: {genes: split[0], taxId: split[1], organism: split[2], sources: split[3].split(',')},
            };
          }
        }),
        map(this.decode.bind(this)),
        map(this.setParameters.bind(this))
      );
  }

  encode({importGenes, taxID, organism, domains, result}): EnrichmentData {
    return {
      data: {
        genes: importGenes.join(','),
        taxId: taxID,
        organism,
        sources: domains
      },
      result
    };
  }

  decode({data, ...rest}: EnrichmentData): EnrichmentParsedData {
    // parse the file content to get gene list and organism tax id and name
    const importGenes = data.genes.split(',');
    const taxID = data.taxId;
    const organism = data.organism;
    const domains = data.sources.filter(domain => domain.length);
    return {
      importGenes, taxID, organism, domains, ...rest
    };
  }

  save(): Observable<Blob> {
    const data: EnrichmentData = this.encode(this);
    return of(new Blob([JSON.stringify(data)]));
  }
}

/****************************************
 * EnrichmentDocument subclass
 *
 * Easier to find w/ this comment block
 */
export class EnrichmentDocument extends BaseEnrichmentDocument {
  constructor(protected readonly worksheetViewerService: EnrichmentTableService) {
    super();
  }

  loadResult(blob: Blob, fileId: string): Observable<this> {
    this.fileId = fileId || '';
    return super.load(blob)
      .pipe(
        mergeMap(() => this.annotate()),
        map(() => this)
      );
  }

  refreshData(): Observable<this> {
    this.result = null;
    if (this.fileId === '') {
      // file was just created
      return this.generateEnrichmentResults(this.domains, this.importGenes, this.taxID).pipe(
        map((result: EnrichmentResult) => {
          this.result = result;
          return this;
        }),
      );
    } else {
      return this.worksheetViewerService.refreshEnrichmentAnnotations([this.fileId]).pipe(
        mergeMap(_ => this.annotate())
      );
    }
  }

  updateParameters(): Observable<Blob> {
    return this.generateEnrichmentResults(this.domains, this.importGenes, this.taxID).pipe(
      mergeMap((result: EnrichmentResult) => {
        const importGenes = this.importGenes;
        const taxID = this.taxID;
        const organism = this.organism;
        const domains = this.domains;
        const data: EnrichmentData = this.encode({importGenes, taxID, organism, domains, result});
        return of(new Blob([JSON.stringify(data)]));
      }));
  }

  private annotate(): Observable<this> {
    // retrieve annotated enrichment snippets if they exist
    return this.worksheetViewerService.getAnnotatedEnrichment(this.fileId).pipe(
      mergeMap((enriched: EnrichmentParsedData) => {
        if (Object.keys(enriched).length > 0) {
          this.result = enriched.result;
          return of(this);
        } else {
          const params = {
            organism: {
              organism_name: this.organism,
              synonym: this.organism,
              tax_id: this.taxID
            },
          } as TextAnnotationGenerationRequest;
          return this.worksheetViewerService.annotateEnrichment([this.fileId], params).pipe(
            mergeMap(() => this.worksheetViewerService.getAnnotatedEnrichment(this.fileId).pipe(
              map((annotated: EnrichmentParsedData) => {
                this.result = annotated.result;
                return this;
              })
            ))
          );
        }
      })
    );
  }

  private generateEnrichmentResults(domains: string[], importGenes: string[],
                                    taxID: string): Observable<EnrichmentResult> {
    return this.worksheetViewerService
      .matchNCBINodes(importGenes, taxID)
      .pipe(
        mergeMap((ncbiNodesData: NCBIWrapper[]) => {
          const neo4jIds = ncbiNodesData.map((wrapper) => wrapper.geneNeo4jId);
          return this.worksheetViewerService
            .getNCBIEnrichmentDomains(neo4jIds, taxID, domains)
            .pipe(
              map((domainResults: EnrichmentWrapper): EnrichmentResult => {
                // a gene can point to 2 different synonyms
                // and a synonym can point to 2 different genes
                const neo4jIdSynonymMap: Map<number, Map<number, string>> = new Map();
                const neo4jIdNodeMap: Map<number, Map<number, NCBINode>> = new Map();
                const neo4jIdLinkMap: Map<number, Map<number, string>> = new Map();
                const geneSynonymNeo4jIdMap: Map<number, Map<number, number>> = new Map();
                const geneMap: Set<string> = new Set();
                const genesList: EnrichedGene[] = [];
                const synonymsSet: Set<string> = new Set();
                // list of tuples
                const synonymNeo4jIds: [number, number][] = [];

                ncbiNodesData.forEach(wrapper => {
                  geneSynonymNeo4jIdMap.has(wrapper.synonymNeo4jId) ? geneSynonymNeo4jIdMap.get(
                    wrapper.synonymNeo4jId).set(wrapper.geneNeo4jId, wrapper.geneNeo4jId) : geneSynonymNeo4jIdMap.set(
                      wrapper.synonymNeo4jId, new Map().set(wrapper.geneNeo4jId, wrapper.geneNeo4jId));

                  neo4jIdSynonymMap.has(wrapper.synonymNeo4jId) ? neo4jIdSynonymMap.get(
                    wrapper.synonymNeo4jId).set(wrapper.geneNeo4jId, wrapper.synonym) : neo4jIdSynonymMap.set(
                      wrapper.synonymNeo4jId, new Map().set(wrapper.geneNeo4jId, wrapper.synonym));

                  neo4jIdNodeMap.has(wrapper.synonymNeo4jId) ? neo4jIdNodeMap.get(
                    wrapper.synonymNeo4jId).set(wrapper.geneNeo4jId, wrapper.gene) : neo4jIdNodeMap.set(
                      wrapper.synonymNeo4jId, new Map().set(wrapper.geneNeo4jId, wrapper.gene));

                  neo4jIdLinkMap.has(wrapper.synonymNeo4jId) ? neo4jIdLinkMap.get(
                    wrapper.synonymNeo4jId).set(wrapper.geneNeo4jId, wrapper.link) : neo4jIdLinkMap.set(
                      wrapper.synonymNeo4jId, new Map().set(wrapper.geneNeo4jId, wrapper.link));

                  synonymsSet.add(wrapper.synonym);
                  synonymNeo4jIds.push([wrapper.synonymNeo4jId, wrapper.geneNeo4jId]);
                });

                for (const [synId, geneId] of synonymNeo4jIds) {
                  const synonym = neo4jIdSynonymMap.get(synId).get(geneId);
                  const node = neo4jIdNodeMap.get(synId).get(geneId);
                  const link = neo4jIdLinkMap.get(synId).get(geneId);
                  const domainWrapper = domainResults[geneSynonymNeo4jIdMap.get(synId).get(geneId)] || null;

                  if (domainWrapper !== null) {
                    geneMap.add(synonym);
                    genesList.push({
                      imported: synonym,
                      annotatedImported: synonym,
                      matched: node.name,
                      annotatedMatched: node.name,
                      fullName: node.full_name || '',
                      annotatedFullName: node.full_name || '',
                      link,
                      domains: this.generateGeneDomainResults(domains, domainWrapper, node)
                    });
                  }
                }

                for (const gene of importGenes) {
                  if (!synonymsSet.has(gene)) {
                    geneMap.add(gene);
                    genesList.push({imported: gene});
                  }
                }

                return {
                  domainInfo: {
                    Regulon: {
                      labels: ['Regulator Family', 'Activated By', 'Repressed By'],
                    },
                    UniProt: {labels: ['Function']},
                    String: {labels: ['Annotation']},
                    GO: {labels: ['Annotation']},
                    BioCyc: {labels: ['Pathways']},
                    KEGG: {labels: ['Pathways']}
                  },
                  genes: genesList,
                };
              }),
            );
        }),
      );
  }

  /**
   * Process wrapper to convert domain data into string array that represents domain columns.
   * If certain properties of domain (result or some property on result) are not defined, add TableCell with empty string.
   * TODO: Could make more efficient by adding domain as input to domain get request.
   * @param domains requested domains
   * @param wrapper data returned from get domains request
   * @param ncbiNode matched ncbi data
   * @returns table entries
   */
  private generateGeneDomainResults(domains: string[], wrapper: DomainWrapper,
                                    ncbiNode: NCBINode): { [domain: string]: EnrichedGeneDomain } {
    const results: { [domain: string]: EnrichedGeneDomain } = {};

    if (domains.includes('Regulon')) {
      if (wrapper.regulon !== null) {
        const regulatorText = nullCoalesce(wrapper.regulon.result.regulator_family, '');
        const activatedText = wrapper.regulon.result.activated_by ? wrapper.regulon.result.activated_by.join('; ') : '';
        const repressedText = wrapper.regulon.result.repressed_by ? wrapper.regulon.result.repressed_by.join('; ') : '';

        results.Regulon = {
          'Regulator Family': {
            text: regulatorText,
            link: wrapper.regulon.link,
            annotatedText: regulatorText
          }, 'Activated By': {
            text: activatedText,
            link: wrapper.regulon.link,
            annotatedText: activatedText
          }, 'Repressed By': {
            text: repressedText,
            link: wrapper.regulon.link,
            annotatedText: repressedText
          },
        };
      }
    }

    if (domains.includes('UniProt')) {
      if (wrapper.uniprot !== null) {
        results.UniProt = {
          Function: {
            text: wrapper.uniprot.result.function,
            link: wrapper.uniprot.link,
            annotatedText: wrapper.uniprot.result.function
          },
        };
      }
    }

    if (domains.includes('String')) {
      if (wrapper.string !== null) {
        results.String = {
          Annotation: {
            text: wrapper.string.result.annotation !== 'annotation not available' ?
              wrapper.string.result.annotation : '',
            annotatedText: wrapper.string.result.annotation !== 'annotation not available' ?
              wrapper.string.result.annotation : '',
            link: wrapper.string.link
          },
        };
      }
    }

    if (domains.includes('GO')) {
      if (wrapper.go !== null) {
        const text = this.shortenTerms(wrapper.go.result);
        results.GO = {
          Annotation: {
            text,
            annotatedText: text,
            link: wrapper.uniprot !== null ? wrapper.go.link + wrapper.uniprot.result.id :
              'http://amigo.geneontology.org/amigo/search/annotation?q=' + encodeURIComponent(ncbiNode.name)
          },
        };
      }
    }

    if (domains.includes('BioCyc')) {
      if (wrapper.biocyc !== null) {
        const text = wrapper.biocyc.result ? wrapper.biocyc.result.join('; ') : '';
        results.BioCyc = {
          Pathways: {
            text,
            annotatedText: text,
            link: wrapper.biocyc.link,
          },
        };
      }
    }

    if (domains.includes('KEGG')) {
      if (wrapper.kegg !== null) {
        const text = this.shortenTerms(wrapper.kegg.result);
        results.KEGG = {
          Pathways: {
            text,
            annotatedText: text,
            link: wrapper.kegg.link,
          },
        };
      }
    }

    return results;
  }

  private shortenTerms(terms: string[]): string {
    return terms
      .map(name => name)
      .slice(0, 5)
      .join('; ') + (terms.length > 5 ? '...' : '');
  }
}

export interface DomainInfo {
  labels: string[];
}

export interface DomainInfoMap {
  [domain: string]: DomainInfo;
}

export interface EnrichmentValue {
  text: string;
  annotatedText?: string;
  link: string;
}

export interface EnrichedGeneDomain {
  [label: string]: EnrichmentValue;
}

export interface EnrichedGene {
  imported: string;
  annotatedImported?: string;
  matched?: string;
  annotatedMatched?: string;
  fullName?: string;
  annotatedFullName?: string;
  link?: string;
  domains?: { [domain: string]: EnrichedGeneDomain };
}

export interface EnrichmentResult {
  domainInfo: DomainInfoMap;
  genes: EnrichedGene[];
}

export interface EnrichmentData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  data: {
    genes: string;
    taxId: string;
    organism: string;
    sources: string[];
  };
  result?: EnrichmentResult;
}

export interface EnrichmentParsedData {
  /**
   * @deprecated the filename does this job
   */
  name?: string;
  importGenes: string[];
  taxID: string;
  organism: string;
  domains: string[];
  result?: EnrichmentResult;
}
