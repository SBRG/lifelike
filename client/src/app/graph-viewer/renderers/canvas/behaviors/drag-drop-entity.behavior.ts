import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { makeid } from 'app/shared/utils/identifiers';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';

export class DragDropEntityBehavior extends AbstractCanvasBehavior {

  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  dragOver(event: BehaviorEvent<DragEvent>): BehaviorResult {
    const dragEvent = event.event;
    if (dragEvent?.dataTransfer.types.includes('application/lifelike-node')) {
      dragEvent.preventDefault();
    }
    return BehaviorResult.Continue;
  }

  drop(event: BehaviorEvent<DragEvent>): BehaviorResult {
    const dragEvent = event.event;
    const data = dragEvent.dataTransfer.getData('application/lifelike-node');
    let node;
    try {
      node = JSON.parse(data) as UniversalGraphNode;
    } catch (e) {
      return BehaviorResult.Continue;
    }

    const hoverPosition = this.graphView.hoverPosition;
    if (hoverPosition != null) {
      this.graphView.execute(new NodeCreation(
        `Create ${node.display_name} node`, {
          hash: makeid(),
          ...node,
          data: {
            ...node.data,
            x: hoverPosition.x,
            y: hoverPosition.y,
          },
        }, true,
      ));
    }

    dragEvent.preventDefault();
    return BehaviorResult.Stop;
  }

}
