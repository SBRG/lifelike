import { Component, Input, } from '@angular/core';

import { SankeyNode } from 'app/shared-sankey/interfaces';

import { SankeyDetailsComponent } from './details.component';

@Component({
  selector: 'app-sankey-node-details',
  templateUrl: './node-details.component.html'
})
// @ts-ignore
export class SankeyNodeDetailsComponent extends SankeyDetailsComponent {
  @Input() entity: SankeyNode;

  biocycLink(biocycId) {
    return 'https://biocyc.org/ECOLI/NEW-IMAGE?object=' + encodeURIComponent(biocycId);
  }

  reactomeLink(stId) {
    return 'https://reactome.org/content/detail/' + encodeURIComponent(stId);
  }
}
