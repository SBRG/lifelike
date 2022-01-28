import { Component, Input } from '@angular/core';

import { Source, UniversalGraphNode, UniversalGraphRelationship } from 'app/drawing-tool/services/interfaces';
import { AssociationSnippet } from 'app/interfaces';

import { getPubtatorSearchUrl } from '../constants';
import { uuidv4 } from '../utils';
import { parseURLToDomainName } from '../utils/browser';
import { getDTCompatibleLabel } from '../utils/drawing-tool';

@Component({
  selector: 'app-node-relationship',
  templateUrl: 'node-relationship-display.component.html',
  styleUrls: ['./node-relationship-display.component.scss'],
})
export class NodeRelationshipComponent {
  @Input() leftNodeName: string;
  @Input() leftNodeLabel: string;
  @Input() leftNodeColor = 'automatic';
  @Input() leftNodeUrl: string;
  @Input() rightNodeName: string;
  @Input() rightNodeLabel: string;
  @Input() rightNodeColor = 'automatic';
  @Input() rightNodeUrl: string;
  @Input() edge: string;
  @Input() snippets: AssociationSnippet[] = [];

  tooltipPosition = 'above';
  droppedEdgeLengthMod = 7;

  constructor() {
  }

  nodeDragStart(event: DragEvent, displayName: string, label: string, databaseUrl: string) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', displayName);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      // Should we give this node a hash here? Seems odd/error-prone not to do so.
      display_name: displayName,
      label: getDTCompatibleLabel(label),
      sub_labels: [],
      data: {
        hyperlinks: [{
          domain: parseURLToDomainName(databaseUrl),
          url: databaseUrl,
        }],
        references: [{
          type: 'DATABASE',
          id: databaseUrl,
        }],
      },
    } as Partial<UniversalGraphNode>));

    // Prevents the edge dragStart event from overriding the node dragStart
    event.stopPropagation();
  }

  edgeDragStart(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    const node1Hash = uuidv4();
    const node2Hash = uuidv4();
    dataTransfer.setData('text/plain', this.edge);
    dataTransfer.setData('application/lifelike-relationship', JSON.stringify({
      node1: {
        hash: node1Hash,
        display_name: this.leftNodeName,
        label: getDTCompatibleLabel(this.leftNodeLabel),
        sub_labels: [],
        data: {
          hyperlinks: [{
            domain: parseURLToDomainName(this.leftNodeUrl),
            url: this.leftNodeUrl,
          }],
          references: [{
            type: 'DATABASE',
            id: this.leftNodeUrl,
          }],
          x: this.edge.length * -1 * this.droppedEdgeLengthMod,
        }
      },
      node2: {
        hash: node2Hash,
        display_name: this.rightNodeName,
        label: getDTCompatibleLabel(this.rightNodeLabel),
        sub_labels: [],
        data: {
          hyperlinks: [{
            domain: parseURLToDomainName(this.rightNodeUrl),
            url: this.rightNodeUrl,
          }],
          references: [{
            type: 'DATABASE',
            id: this.rightNodeUrl,
          }],
          x: this.edge.length * 1 * this.droppedEdgeLengthMod,
        }
      },
      edge: {
        from: node1Hash,
        to: node2Hash,
        data: {
          sources: this.snippets.map(snippet => {
            return {
              type: 'DATABASE',
              domain: snippet.publication.data.title || 'Unknown',
              url: getPubtatorSearchUrl(snippet.publication.data.pmid)
            } as Source;
          })
        },
        label: this.edge,
      }
    } as Partial<UniversalGraphRelationship>));
  }
}
