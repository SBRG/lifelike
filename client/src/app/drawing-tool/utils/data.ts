import { groupBy } from 'lodash-es';

import { uuidv4 } from 'app/shared/utils/identifiers';
import { GraphAction } from 'app/graph-viewer/actions/actions';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { EdgeCreation } from 'app/graph-viewer/actions/edges';
import { DataTransferData } from 'app/shared/services/data-transfer-data.service';

import { GRAPH_ENTITY_TOKEN } from '../providers/graph-entity-data.provider';
import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphEdge,
  UniversalGraphNode,
} from '../services/interfaces';

export function extractGraphEntityActions(items: DataTransferData<any>[], origin: { x: number, y: number }) {
  let entities: GraphEntity[] = [];
  const actions: GraphAction[] = [];

  for (const item of items) {
    if (item.token === GRAPH_ENTITY_TOKEN) {
      entities = item.data as GraphEntity[];
    }
  }

  entities = normalizeGraphEntities(entities, origin);

  // Create nodes and edges
  for (const entity of entities) {
    if (entity.type === GraphEntityType.Node) {
      const node = entity.entity as UniversalGraphNode;
      actions.push(new NodeCreation(
        `Create ${node.display_name} node`, node, true,
      ));
    } else if (entity.type === GraphEntityType.Edge) {
      const edge = entity.entity as UniversalGraphEdge;
      actions.push(new EdgeCreation(
        `Create edge`, edge, true,
      ));
    }
  }

  return actions;
}

export function normalizeGraphEntities(entities: GraphEntity[], origin: { x: number, y: number }): GraphEntity[] {
  const newEntities: GraphEntity[] = [];
  const nodeHashMap = new Map<string, string>();
  const nodes = [];
  const edges = [];
  entities.forEach((entity) => entity.type === GraphEntityType.Node ? nodes.push(entity) : edges.push(entity));

  // Create nodes and edges
  for (const entity of nodes) {
    const node = entity.entity as UniversalGraphNode;
    // Creating a new hash like this when we're assuming that a hash already exists seems kind of fishy to me. Leaving this here
    // because I don't want to break anything, but it's worth pointing out.
    const newId = node.hash || uuidv4();
    nodeHashMap.set(node.hash, newId);
    newEntities.push({
      type: GraphEntityType.Node,
      entity: {
        ...node,
        hash: newId,
        data: {
          ...node.data,
          x: origin.x + ((node.data && node.data.x) || 0),
          y: origin.y + ((node.data && node.data.y) || 0),
        },
      },
    });
  }

  for (const entity of edges) {
    const edge = entity.entity as UniversalGraphEdge;
    const newFrom = nodeHashMap.get(edge.from);
    const newTo = nodeHashMap.get(edge.to);
    if (newFrom != null && newTo != null) {
      newEntities.push({
        type: GraphEntityType.Edge,
        entity: {
          ...edge,
          from: newFrom,
          to: newTo,
        },
      });
    }
  }

  return newEntities;
}
