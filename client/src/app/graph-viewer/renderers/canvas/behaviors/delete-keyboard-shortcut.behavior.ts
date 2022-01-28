import {
  GraphEntityType,
  UniversalGraphEdge,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { EdgeDeletion } from 'app/graph-viewer/actions/edges';
import { NodeDeletion } from 'app/graph-viewer/actions/nodes';
import { GraphAction } from 'app/graph-viewer/actions/actions';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';


/**
 * Implements the 'delete' key.
 */
export class DeleteKeyboardShortcutBehavior extends AbstractCanvasBehavior {
  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  keyDown(event: BehaviorEvent<KeyboardEvent>): BehaviorResult {
  // keyDown(event: KeyboardEvent): BehaviorResult {
    if (event.event.key === 'Delete') {
      const actions0: GraphAction[] = [];
      const actions1: GraphAction[] = [];
      for (const entity of this.graphView.selection.get()) {
        if (entity.type === GraphEntityType.Node) {
          actions1.push(new NodeDeletion('Delete node', entity.entity as UniversalGraphNode));
        } else if (entity.type === GraphEntityType.Edge) {
          actions0.push(new EdgeDeletion('Delete edge', entity.entity as UniversalGraphEdge));
        }
      }
      this.graphView.execute(...actions0);
      this.graphView.execute(...actions1);
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }
}
