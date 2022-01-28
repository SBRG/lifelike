/**
 * This file contains actions for the graph, such as adding or removing nodes,
 * which may be committed to history for rollback or re-application.
 */

import { UniversalGraphEdge, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';

import { CacheGuardedEntityList } from '../utils/cache-guarded-entity-list';

/**
 * A graph component manages a graph and may render it.
 */
export interface GraphActionReceiver {
  selection: CacheGuardedEntityList;

  /**
   * Add the given node to the graph.
   * @param node the node
   */
  addNode(node: UniversalGraphNode): void;

  /**
   * Remove the given node from the graph.
   * @param node the node
   */
  removeNode(node: UniversalGraphNode): {
    found: boolean,
    removedEdges: UniversalGraphEdge[],
  };

  /**
   * Mark the node as being updated.
   * @param node the node
   */
  updateNode(node: UniversalGraphNode): void;

  /**
   * Add the given edge to the graph.
   * @param edge the edge
   */
  addEdge(edge: UniversalGraphEdge): void;

  /**
   * Remove the given edge from the graph.
   * @param edge the edge
   * @return true if the edge was found
   */
  removeEdge(edge: UniversalGraphEdge): boolean;

  /**
   * Mark the edge as being updated.
   * @param edge the node
   */
  updateEdge(edge: UniversalGraphEdge): void;

  /**
   * Focus the selected entity (aka focus on the related sidebar for the selection).
   */
  focusEditorPanel(): void;
}

/**
 * An action is something the user performed on a {@link GraphActionReceiver}
 * that can be applied or rolled back.
 */
export interface GraphAction {
  /**
   * A user friendly description of the action for a history log.
   */
  description: string;

  /**
   * Called to perform the action.
   * @param component the component with the graph
   */
  apply: (component: GraphActionReceiver) => void;

  /**
   * Called to undo the action.
   * @param component the component with the graph
   */
  rollback: (component: GraphActionReceiver) => void;
}

/**
 * Combines a list of actions together as one.
 */
export class CompoundAction implements GraphAction {
  /**
   * Create a new instance.
   * @param description description of this compound action
   * @param actions first action is applied first, rolled back last
   */
  constructor(readonly description: string,
              readonly actions: GraphAction[]) {
  }

  apply(component: GraphActionReceiver) {
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < this.actions.length; i++) {
      this.actions[i].apply(component);
    }
  }

  rollback(component: GraphActionReceiver) {
    for (let i = this.actions.length - 1; i >= 0; i--) {
      this.actions[i].rollback(component);
    }
  }
}
