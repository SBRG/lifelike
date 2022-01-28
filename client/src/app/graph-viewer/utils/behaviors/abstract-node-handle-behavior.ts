// @ts-ignore
import * as d3 from 'd3';

import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import {nullCoalesce} from 'app/shared/utils/types';

import {
  AbstractCanvasBehavior,
  BehaviorResult,
  DragBehaviorEvent,
} from '../../renderers/behaviors';
import { PlacedNode } from '../../styles/styles';
import { CanvasGraphView } from '../../renderers/canvas/canvas-graph-view';

export abstract class AbstractNodeHandleBehavior<T extends Handle> extends AbstractCanvasBehavior {
  protected handle: T | undefined;

  constructor(protected readonly graphView: CanvasGraphView,
              protected readonly target: UniversalGraphNode) {
    super();
  }

  dragStart(event: DragBehaviorEvent): BehaviorResult {
    const transform = this.graphView.transform;
    const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
    const graphX = transform.invertX(mouseX);
    const graphY = transform.invertY(mouseY);
    const subject = event.entity;

    if (subject != null && subject.type === GraphEntityType.Node) {
      this.handle = this.getHandleIntersected(this.graphView.placeNode(this.target), graphX, graphY);
      if (this.handle != null) {
        this.activeDragStart(event.event, graphX, graphY, subject);
      }
    }

    return BehaviorResult.Continue;
  }

  drag(event: DragBehaviorEvent): BehaviorResult {
    if (this.handle) {
      const transform = this.graphView.transform;
      const [mouseX, mouseY] = d3.mouse(this.graphView.canvas);
      const graphX = transform.invertX(mouseX);
      const graphY = transform.invertY(mouseY);
      this.activeDrag(event.event, graphX, graphY);
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }

  dragEnd(event: DragBehaviorEvent): BehaviorResult {
    this.drag(event);
    this.handle = null;
    this.activeDragEnd(event.event);
    return BehaviorResult.Continue;
  }

  getCurrentNodeSize(): { width: number, height: number } {
    let width = this.target.data.width;
    let height = this.target.data.height;

    if (width == null || height == null) {
      const bbox = this.graphView.placeNode(this.target).getBoundingBox();

      if (width == null) {
        width = bbox.maxX - bbox.minX + 1;
      }
      if (height == null) {
        height = bbox.maxY - bbox.minY + 1;
      }
    }

    return {width, height};
  }

  isPointIntersectingNode(placedNode: PlacedNode, x: number, y: number): boolean {
    return this.getHandleIntersected(placedNode, x, y) ? true : undefined;
  }

  getHandleIntersected(placedNode: PlacedNode, x: number, y: number): T | undefined {
    for (const handle of this.getHandleBoundingBoxes(placedNode)) {
      if (x >= handle.minX && x <= handle.maxX && y >= handle.minY && y <= handle.maxY) {
        return handle;
      }
    }
    return null;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
    const placedNode = this.graphView.placeNode(this.target);

    for (const handle of Object.values(this.getHandleBoundingBoxes(placedNode))) {
      this.drawHandle(ctx, transform, handle);
    }
  }

  drawHandle(ctx: CanvasRenderingContext2D, transform: any, {minX, minY, maxX, maxY, displayColor}: T) {
    ctx.beginPath();
    ctx.lineWidth = 1 / transform.scale(1).k;
    if (document.activeElement === this.graphView.canvas) {
      ctx.fillStyle = nullCoalesce(displayColor, '#000');
      ctx.strokeStyle = '#fff';
    } else {
      ctx.fillStyle = '#CCC';
      ctx.strokeStyle = '#999';
    }
    ctx.fillRect(minX, minY, maxX - minX, maxY - minY);
    ctx.stroke();

  }

  abstract getHandleBoundingBoxes(placedNode: PlacedNode): T[];

  protected activeDragStart(event: MouseEvent, graphX: number, graphY: number, subject: GraphEntity | undefined) {
  }

  protected activeDrag(event: MouseEvent, graphX: number, graphY: number) {
  }

  protected activeDragEnd(event: MouseEvent) {
  }
}

export interface Handle {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  displayColor?: string;
}
