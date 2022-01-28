import { isCtrlOrMetaPressed, isShiftPressed } from 'app/shared/utils';
import { GraphEntity } from 'app/drawing-tool/services/interfaces';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult, DragBehaviorEvent } from '../../behaviors';

const REGION_SELECTION_BEHAVIOR_KEY = '_selectable-entity/region';

export class SelectableEntityBehavior extends AbstractCanvasBehavior {
  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  private isRegionSelectionAdditive(event: MouseEvent) {
    return isShiftPressed(event);
  }

  private isRegionSelecting(event: MouseEvent) {
    return isCtrlOrMetaPressed(event) || isShiftPressed(event);
  }

  shouldDrag(event: BehaviorEvent<MouseEvent>): boolean {
    return this.isRegionSelecting(event.event);
  }

  click(event: BehaviorEvent<MouseEvent>): BehaviorResult {
    const entity = this.graphView.getEntityAtMouse();
    if (entity == null) {
      this.graphView.selection.replace([]);
    } else if (isCtrlOrMetaPressed(event.event) || isShiftPressed(event.event)) {
      this.amendSelection(entity);
    } else {
      this.graphView.selection.replace([entity]);
    }
    this.graphView.requestRender();
    return BehaviorResult.Continue;
  }

  dragStart(event: DragBehaviorEvent): BehaviorResult {
    if (this.isRegionSelecting(event.event)) {
      const [x, y] = this.graphView.getLocationAtMouse();
      this.graphView.behaviors.delete(REGION_SELECTION_BEHAVIOR_KEY);
      this.graphView.behaviors.add(REGION_SELECTION_BEHAVIOR_KEY,
        new ActiveRegionSelection(this.graphView, [x, y], this.isRegionSelectionAdditive(event.event)), 2);
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }

  private amendSelection(entity: GraphEntity) {
    const selection = [...this.graphView.selection.get()];
    let found = false;
    for (let i = 0; i < selection.length; i++) {
      if (selection[i].entity === entity.entity) {
        found = true;
        selection.splice(i, 1);
        break;
      }
    }
    if (!found) {
      selection.push(entity);
    }
    this.graphView.selection.replace(selection);
    this.graphView.dragging.replace(selection);
    this.graphView.invalidateEntity(entity);
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
  }
}

class ActiveRegionSelection extends AbstractCanvasBehavior {

  private regionEnd: [number, number];

  constructor(private readonly graphView: CanvasGraphView,
              private readonly regionStart: [number, number],
              private readonly additive: boolean) {
    super();
    this.regionEnd = regionStart;
  }

  private getBoundingBox() {
    const minX = Math.min(this.regionStart[0], this.regionEnd[0]);
    const maxX = Math.max(this.regionStart[0], this.regionEnd[0]);
    const minY = Math.min(this.regionStart[1], this.regionEnd[1]);
    const maxY = Math.max(this.regionStart[1], this.regionEnd[1]);
    return [minX, minY, maxX, maxY];
  }

  drag(event: DragBehaviorEvent): BehaviorResult {
    this.regionEnd = this.graphView.getLocationAtMouse();
    this.graphView.requestRender();
    return BehaviorResult.Continue;
  }

  dragEnd(event: DragBehaviorEvent): BehaviorResult {
    this.regionEnd = this.graphView.getLocationAtMouse();
    const [minX, minY, maxX, maxY] = this.getBoundingBox();
    const selected = this.graphView.getEntitiesWithinBBox(minX, minY, maxX, maxY);
    if (this.additive) {
      this.graphView.selection.add(selected);
    } else {
      this.graphView.selection.replace(selected);
    }
    this.graphView.requestRender();
    return BehaviorResult.RemoveAndContinue;
  }

  draw(ctx: CanvasRenderingContext2D, transform: any) {
    const [minX, minY, maxX, maxY] = this.getBoundingBox();
    const width = maxX - minX;
    const height = maxY - minY;

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(12, 140, 170, 0.2)';
    ctx.strokeStyle = 'rgba(12, 140, 170, 1)';
    ctx.lineWidth = 2 / this.graphView.transform.scale(1).k;
    ctx.rect(minX, minY, width, height);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

}
