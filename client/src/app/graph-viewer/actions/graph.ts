import { GraphEntity, GraphEntityType, UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { mergeDeep } from 'app/graph-viewer/utils/objects';

import { GraphAction, GraphActionReceiver } from './actions';

/**
 * Represents the movement of a node.
 */
export class GraphEntityUpdate implements GraphAction {
  constructor(public description: string,
              public entity: GraphEntity,
              public updatedData: object,
              public originalData: object) {
  }

  apply(component: GraphActionReceiver) {
    mergeDeep(this.entity.entity, this.updatedData);
    if (this.entity.type === GraphEntityType.Node) {
      component.updateNode(this.entity.entity as UniversalGraphNode);
    } else if (this.entity.type === GraphEntityType.Edge) {
      component.updateEdge(this.entity.entity as UniversalGraphEdge);
    }
  }

  rollback(component: GraphActionReceiver) {
    mergeDeep(this.entity.entity, this.originalData);
    if (this.entity.type === GraphEntityType.Node) {
      component.updateNode(this.entity.entity as UniversalGraphNode);
    } else if (this.entity.type === GraphEntityType.Edge) {
      component.updateEdge(this.entity.entity as UniversalGraphEdge);
    }
  }
}
