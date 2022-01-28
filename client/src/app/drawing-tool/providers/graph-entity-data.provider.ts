import { Injectable } from '@angular/core';

import {
  DataTransferData,
  DataTransferDataProvider,
  DataTransferToken,
} from 'app/shared/services/data-transfer-data.service';
import {
  GenericDataProvider,
  LABEL_TOKEN,
  URI_TOKEN,
  URIData,
} from 'app/shared/providers/data-transfer-data/generic-data.provider';
import { makeid } from 'app/shared/utils/identifiers';

import { GraphEntity, GraphEntityType, UniversalGraphNode, UniversalGraphRelationship } from '../services/interfaces';

export const GRAPH_ENTITY_TOKEN = new DataTransferToken<GraphEntity[]>('universalGraphEntity');
export const GRAPH_NODE_TYPE = 'application/lifelike-node';
export const GRAPH_RELATIONSHIP_TYPE = 'application/lifelike-relationship';
export const GRAPH_ENTITY_TYPES = [
  GRAPH_NODE_TYPE,
  GRAPH_RELATIONSHIP_TYPE
];

@Injectable()
export class GraphEntityDataProvider implements DataTransferDataProvider {

  constructor(protected readonly genericDataProvider: GenericDataProvider) {
  }


  extract(dataTransfer: DataTransfer): DataTransferData<any>[] {
    const results: DataTransferData<GraphEntity[]>[] = [];

    const nodeData = dataTransfer.getData(GRAPH_NODE_TYPE);
    const relationshipData = dataTransfer.getData(GRAPH_RELATIONSHIP_TYPE);

    // First check if the content has a node embedded in it
    if (nodeData) {
      const node = JSON.parse(nodeData) as UniversalGraphNode;
      results.push({
        token: GRAPH_ENTITY_TOKEN,
        data: [{
          type: GraphEntityType.Node,
          entity: node,
        }],
        confidence: 0,
      });
    }

    // Then check if it has a relationship embedded in it
    if (relationshipData) {
      const {node1, node2, edge} = JSON.parse(relationshipData) as UniversalGraphRelationship;
      results.push({
        token: GRAPH_ENTITY_TOKEN,
        data: [
          {
            type: GraphEntityType.Node,
            entity: node1,
          },
          {
            type: GraphEntityType.Node,
            entity: node2,
          },
          {
            type: GraphEntityType.Edge,
            entity: edge,
          }
        ],
        confidence: 0,
      });
    }

    // Otherwise try to create a note or link node from available data
    if (!nodeData && !relationshipData) {
      const items = this.genericDataProvider.extract(dataTransfer);
      let text: string | undefined = null;
      const uriData: URIData[] = [];

      for (const item of items) {
        if (item.token === URI_TOKEN) {
          uriData.push(...(item.data as URIData[]));
        } else if (item.token === LABEL_TOKEN) {
          text = item.data as string;
        }
      }

      if (text != null) {
        const isLink = !!text.match(/^((?:http|ftp)s?|mailto):/);

        results.push({
          token: GRAPH_ENTITY_TOKEN,
          data: [{
            type: GraphEntityType.Node,
            entity: {
              hash: makeid(),
              display_name: isLink ? 'Link' : 'Note',
              label: isLink ? 'link' : 'note',
              sub_labels: [],
              data: {
                x: 0,
                y: 0,
                detail: text,
                sources: uriData.map(item => ({
                  domain: item.title,
                  url: item.uri
                })),
              },
              style: {
                showDetail: !isLink,
              },
            },
          }],
          confidence: 0,
        });
      }
    }

    return results;
  }

}
