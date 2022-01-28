import { cloneDeep } from 'lodash-es';
import * as d3 from 'd3';

import { GraphEntity, GraphEntityType, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { GraphEntityUpdate } from 'app/graph-viewer/actions/graph';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { isCtrlOrMetaPressed, isShiftPressed } from 'app/shared/utils';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior, BehaviorResult, DragBehaviorEvent } from '../../behaviors';

export class MovableNode extends AbstractCanvasBehavior {
  /**
   * Stores the offset between the node and the initial position of the mouse
   * when clicked during the start of a drag event. Used for node position stability
   * when the user is dragging nodes on the canvas, otherwise the node 'jumps'
   * so node center is the same the mouse position, and the jump is not what we want.
   */
  private target: UniversalGraphNode | undefined;
  private originalTarget: UniversalGraphNode | undefined;
  private startMousePosition: [number, number] = [0, 0];
  private originalNodePositions = new Map<UniversalGraphNode, [number, number]>();

  constructor(protected readonly graphView: CanvasGraphView) {
    super();
  }

  dragStart(event: DragBehaviorEvent): BehaviorResult {
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const transform = this.graphView.transform;
    const entity = event.entity;

    if (entity != null && entity.type === GraphEntityType.Node) {
      const node = entity.entity as UniversalGraphNode;

      this.startMousePosition = [transform.invertX(mouseX), transform.invertY(mouseY)];

      this.target = node;
      this.originalTarget = cloneDeep(this.target);
    }

    return BehaviorResult.Continue;
  }

  drag(event: DragBehaviorEvent): BehaviorResult {
    // TODO: cache
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const transform = this.graphView.transform;

    if (this.target) {
      const shiftX = transform.invertX(mouseX) - this.startMousePosition[0];
      const shiftY = transform.invertY(mouseY) - this.startMousePosition[1];

      const selectedNodes = new Set<UniversalGraphNode>();

      for (const entity of this.graphView.selection.get()) {
        if (entity.type === GraphEntityType.Node) {
          const node = entity.entity as UniversalGraphNode;
          selectedNodes.add(node);
        }
      }

      // If the user is moving a node that isn't selected, then we either (a) want to
      // deselect everything, select just the target node, and then move only the target
      // node, or (b) if the user is holding down the multiple selection modifier key
      // (CTRL or CMD), then we add the target node to the selection and move the whole group
      if (!selectedNodes.has(this.target)) {
        // Case (a)
        if (!isCtrlOrMetaPressed(event.event) && !isShiftPressed(event.event)) {
          selectedNodes.clear();
        }

        selectedNodes.add(this.target);

        // Update the selection
        this.graphView.selection.replace([...selectedNodes].map(node => ({
          type: GraphEntityType.Node,
          entity: node,
        })));
      }

      for (const node of selectedNodes) {
        if (!this.originalNodePositions.has(node)) {
          this.originalNodePositions.set(node, [node.data.x, node.data.y]);
        }
        const [originalX, originalY] = this.originalNodePositions.get(node);
        node.data.x = originalX + shiftX;
        node.data.y = originalY + shiftY;
        this.graphView.nodePositionOverrideMap.set(node, [node.data.x, node.data.y]);
        this.graphView.invalidateNode(node);
        // TODO: Store this in history as ONE object
      }
    }

    return BehaviorResult.Continue;
  }

  dragEnd(event: DragBehaviorEvent): BehaviorResult {
    if (this.target) {
      if (this.target.data.x !== this.originalTarget.data.x ||
          this.target.data.y !== this.originalTarget.data.y) {
        const actions: GraphAction[] = [];

        for (const [node, [originalX, originalY]] of
            this.originalNodePositions.entries()) {
          actions.push(new GraphEntityUpdate('Move node', {
            type: GraphEntityType.Node,
            entity: node,
          }, {
            data: {
              x: node.data.x,
              y: node.data.y,
            },
          } as Partial<UniversalGraphNode>, {
            data: {
              x: originalX,
              y: originalY,
            },
          } as Partial<UniversalGraphNode>));
        }

        this.graphView.execute(new CompoundAction('Node move', actions));

        this.target = null;
        this.originalNodePositions.clear();

        return BehaviorResult.Stop;
      } else {
        this.target = null;
        this.originalNodePositions.clear();

        return BehaviorResult.Continue;
      }
    } else {
      this.originalNodePositions.clear();

      return BehaviorResult.Continue;
    }
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
  }
}
