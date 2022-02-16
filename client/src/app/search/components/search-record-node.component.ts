import { Component, Input } from '@angular/core';

import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { FTSQueryRecord } from 'app/interfaces';
import { DBHostname } from 'app/shared/constants';
import { stringToHex } from 'app/shared/utils';
import { parseURLToDomainName } from 'app/shared/utils/browser';

import { GraphSearchParameters } from '../graph-search';
import { getLink } from '../utils/records';
import { getGraphQueryParams } from '../utils/search';

@Component({
  selector: 'app-search-record-node',
  templateUrl: 'search-record-node.component.html',
  styleUrls: ['./search-record-node.component.scss'],
})
export class SearchRecordNodeComponent {

  private currentNode: FTSQueryRecord;
  nodeURL: string;
  normalizedNodeLabel: string;
  private readonly defaultDomain = 'Knowledge Graph';

  @Input() params: GraphSearchParameters;

  @Input() legend: Map<string, string>;

  @Input()
  set node(value: FTSQueryRecord) {
    this.currentNode = value;
    this.normalizedNodeLabel = value.node.label.toLowerCase();
    this.nodeURL = stringToHex(value.node.id.toString());
  }

  get node(): FTSQueryRecord {
    return this.currentNode;
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    let url: URL | string;
    let domain = '';

    try {
      url = new URL(getLink(this.node));
      domain = parseURLToDomainName(url.href, this.defaultDomain);
    } catch {
      // Expect a TypeError here if the url was invalid
      url = getLink(this.node);
      domain = this.defaultDomain;
    }

    dataTransfer.setData('text/plain', this.node.node.displayName);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: this.node.node.displayName,
      label: this.node.node.label.toLowerCase(),
      sub_labels: [],
      data: {
        hyperlinks: [{
          domain,
          url: url.toString()
        }],
        references: [{
          type: 'DATABASE',
          id: getLink(this.node),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }

  getNodeDomain(url: URL): string {
    switch (url.hostname) {
      case DBHostname.UniProt:
        return 'UniProt';
      case DBHostname.NCBI:
        if (url.href.includes('mesh')) {
          return 'MeSH';
        }
        if (url.href.includes('Taxonomy')) {
          return 'NCBI Taxonomy';
        }
        if (url.href.includes('gene')) {
          return 'NCBI Gene';
        }
        return 'NCBI';
      case DBHostname.ChEBI:
        return 'ChEBI';
      case DBHostname.GO:
        return 'GO';
      default:
        return 'Knowledge Graph';
    }
  }

  getVisualizerQueryParams(params) {
    return {
      ...getGraphQueryParams(this.params),
      ...params,
    };
  }
}
