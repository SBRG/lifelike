import { Component, Input, OnChanges } from '@angular/core';
import { KeyValue } from '@angular/common';

import { annotationTypesMap } from 'app/shared/annotation-styles';
import { EnrichWithGOTermsResult, EnrichmentVisualisationService } from 'app/enrichment/services/enrichment-visualisation.service';

class GeneRow {
  values: boolean[];
  frequency: number;
  others: number;

  constructor(sliceSize) {
    this.values = new Array(sliceSize);
    this.frequency = 0;
    this.others = 0;
  }
}

@Component({
  selector: 'app-clustergram',
  templateUrl: './clustergram.component.html',
  styleUrls: ['./clustergram.component.scss']
})
export class ClustergramComponent implements OnChanges {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() showMore: boolean;
  @Input() show: boolean;

  genes = new Map<string, GeneRow>();
  others: GeneRow | undefined;
  goTerms: EnrichWithGOTermsResult[] = [];
  geneColor: string = annotationTypesMap.get('gene').color;

  constructor(readonly enrichmentService: EnrichmentVisualisationService) {
  }

  rowOrder(a: KeyValue<string, GeneRow>, b: KeyValue<string, GeneRow>) {
    return b.value.frequency - a.value.frequency;
  }

  columnOrder(a: EnrichWithGOTermsResult, b: EnrichWithGOTermsResult) {
    return b.geneNames.length - a.geneNames.length;
  }

  ngOnChanges() {
    if (this.show) {
      const data = [...this.data].sort(this.columnOrder);
      const sliceSize = Math.min(data.length, this.showMore ? 50 : 25);
      const genes = new Map<string, GeneRow>();
      let others: GeneRow | undefined;
      const goTerms = data.slice(0, sliceSize);
      data.forEach(({geneNames}, goIndex) => {
        geneNames.forEach(g => {
          let geneRow = genes.get(g);
          if (!geneRow) {
            if (goIndex < sliceSize) {
              geneRow = new GeneRow(sliceSize);
              genes.set(g, geneRow);
            } else {
              if (!others) {
                others = new GeneRow(sliceSize);
              }
              geneRow = others;
            }
          }
          geneRow.frequency++;
          if (goIndex < sliceSize) {
            geneRow.values[goIndex] = true;
          } else {
            geneRow.others++;
          }
        });
      });
      this.genes = genes;
      this.others = others;
      this.goTerms = goTerms;
    }
  }
}
