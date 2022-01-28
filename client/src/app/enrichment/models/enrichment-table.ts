import { Observable, of } from 'rxjs';
import { isEqual } from 'lodash-es';

import { TableCell, TableHeader } from 'app/shared/components/table/generic-table.component';
import { nullCoalesce } from 'app/shared/utils/types';

import { EnrichmentDocument, EnrichmentResult } from './enrichment-document';

export class EnrichmentTable {

  protected readonly usePlainText: boolean;
  tableHeader: TableHeader[][] = [];
  tableCells: TableCell[][] = [];

  constructor(options: { usePlainText?: boolean } = {}) {
    this.usePlainText = options.usePlainText || false;
  }

  load(document: EnrichmentDocument): Observable<this> {
    const tableCells: TableCell[][] = [];
    const tableHeader: TableHeader[][] = [
      [
        {name: 'Imported', span: '1'},
        {name: 'Matched', span: '1'},
        {name: 'NCBI Gene Full Name', span: '1'},
      ],
    ];

    const result: EnrichmentResult | undefined = document.result;

    if (result != null) {
      const domainInfoMap = result.domainInfo;

      // Some domains have multiple labels so we need to activate a
      // second header line in those cases
      let tableHeaderLine2Needed = false;
      const tableHeaderLine2: TableHeader[] = [
        {name: '', span: '3'},
      ];

      for (const domainId of document.domains) {
        const domainInfo = domainInfoMap[domainId];

        // If a domain has one label, we put that label in the first header
        // row like (Domain) (Label), otherwise we put each label in its own cell on the
        // second header row
        tableHeader[0].push({
          name: domainId + (domainInfo.labels.length > 1 ? '' : ' ' +
            nullCoalesce(domainInfo.labels[0], '')),
          span: String(domainInfo.labels.length),
        });

        if (domainInfo.labels.length > 1) {
          tableHeaderLine2Needed = true;

          for (const label of domainInfo.labels) {
            tableHeaderLine2.push({
              name: label,
              span: '1',
            });
          }
        } else {
          tableHeaderLine2.push({
            name: '',
            span: '1',
          });
        }
      }

      if (tableHeaderLine2Needed) {
        tableHeader.push(tableHeaderLine2);
      }

      // if enrichment is not annotated, annotatedText == text
      // that's why can set text properties like this
      for (const resultGene of result.genes) {
        const row: TableCell[] = [{
          text: this.usePlainText ? resultGene.imported : resultGene.annotatedImported || resultGene.imported,
        }];

        if (resultGene.domains) {
          // There was a match
          row.push({
            text: this.usePlainText ? resultGene.matched : resultGene.annotatedMatched,
          });

          if (resultGene.fullName && resultGene.annotatedFullName) {
            row.push({
              text: this.usePlainText ? resultGene.fullName : resultGene.annotatedFullName,
              singleLink: {
                link: resultGene.link,
                linkText: 'NCBI Link',
              },
            });
          } else {
            row.push({text: ''});
          }

          for (const domainId of document.domains) {
            const domainInfo = domainInfoMap[domainId];
            for (const label of domainInfo.labels) {
              const geneDomainResult = resultGene.domains[domainId] && resultGene.domains[domainId][label];
              if (geneDomainResult) {
                row.push({
                  text: this.usePlainText ? geneDomainResult.text : geneDomainResult.annotatedText,
                  singleLink: {
                    link: geneDomainResult.link,
                    linkText: `${domainId} Link`,
                  },
                });
              } else {
                row.push({text: ''});
              }
            }
          }

        } else {
          // No gene match
          row.push({text: 'No match found.'});
          row.push({text: ''});

          // Add a bunch of empty cells
          for (const domainId of document.domains) {
            const domainInfo = domainInfoMap[domainId];
            for (const label of domainInfo.labels) {
              row.push({text: ''});
            }
          }
        }

        tableCells.push(row);
      }
    }

    this.tableHeader = tableHeader;
    this.tableCells = tableCells;

    return of(this);
  }

  equals(other: EnrichmentTable) {
    return isEqual(this.tableHeader, other.tableHeader) && isEqual(this.tableCells, other.tableCells);
  }

}
