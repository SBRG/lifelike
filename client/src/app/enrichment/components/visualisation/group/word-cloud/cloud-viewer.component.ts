import { Component, OnChanges, Input, SimpleChanges } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { map } from 'rxjs/operators';

import { annotationTypesMap } from 'app/shared/annotation-styles';
import { EnrichWithGOTermsResult } from 'app/enrichment/services/enrichment-visualisation.service';
import { WordCloudNode } from 'app/shared/components/word-cloud/word-cloud.component';
import { WorkspaceManager } from 'app/shared/workspace-manager';

import { paramsToEnrichmentTableLink, triggerSearchOnShouldReplaceTab } from '../../components/link/link.directive';

@Component({
  selector: 'app-cloud-viewer',
  templateUrl: './cloud-viewer.component.html'
})
export class CloudViewerComponent implements OnChanges {
  @Input() data: EnrichWithGOTermsResult[];
  @Input() showMore: boolean;
  geneColor = annotationTypesMap.get('gene').color;

  slicedData: WordCloudNode[];
  @Input() timeInterval = Infinity;
  @Input() show = true;
  link;

  constructor(
    private workspaceManager: WorkspaceManager,
    private route: ActivatedRoute
  ) {
    route.params.pipe(
      map(paramsToEnrichmentTableLink)
    ).subscribe(
      link => {
        this.link = link;
      }
    );
  }

  onClick(d) {
    const encodedText = encodeURIComponent(d.text);
    this.workspaceManager.navigateByUrl({
      url: `${this.link.appLink.join('/')}#text=${encodedText}`,
      extras: {
        newTab: true,
        sideBySide: true,
        matchExistingTab: this.link.matchExistingTab,
        shouldReplaceTab: triggerSearchOnShouldReplaceTab(d.text)
      },
  }
    );
  }

  enter(selection) {
    selection.on('click', this.onClick.bind(this))
      .style('cursor', 'pointer');
  }

  ngOnChanges({data}: SimpleChanges) {
    const color = this.geneColor;
    if (this.show && data) {
      this.slicedData = Object.entries(
        data.currentValue.reduce((o, n) => {
          n.geneNames.forEach(g => {
            o[g] = o[g] || 0;
            o[g] += 1;
          });
          return o;
        }, {} as { [geneName: string]: number })
      )
        .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
        .slice(0, 250)
        .map(([text, frequency]) => ({text, frequency, color} as WordCloudNode));
    }
  }
}
