import { cloneDeep } from 'lodash-es';

import { GraphEntity, GraphEntityType, UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { PlacedNode } from 'app/graph-viewer/styles/styles';
import { GraphEntityUpdate } from 'app/graph-viewer/actions/graph';
import { AbstractNodeHandleBehavior, Handle } from 'app/graph-viewer/utils/behaviors/abstract-node-handle-behavior';
import { handleBlue } from 'app/shared/constants';

import { CanvasGraphView } from '../canvas-graph-view';
import { AbstractCanvasBehavior } from '../../behaviors';

const BEHAVIOR_KEY = '_handle-resizable/active';

/**
 * Adds the UX to let nodes be resized via handles.
 */
export class HandleResizableBehavior extends AbstractCanvasBehavior {
  /**
   * Subscription for when the selection changes.
   */
  private selectionChangeSubscription;

  constructor(private readonly graphView: CanvasGraphView) {
    super();
  }

  setup() {
    this.selectionChangeSubscription = this.graphView.selection.changeObservable.subscribe(([newSelection, oldSelection]) => {
      if (newSelection.length === 1 && newSelection[0].type === GraphEntityType.Node &&
        this.graphView.placeNode(newSelection[0].entity as UniversalGraphNode).resizable) {
        this.graphView.behaviors.delete(BEHAVIOR_KEY);
        this.graphView.behaviors.add(BEHAVIOR_KEY, new ActiveResize(this.graphView, newSelection[0].entity as UniversalGraphNode), 100);
      } else {
        this.graphView.behaviors.delete(BEHAVIOR_KEY);
      }
    });
  }
}

/**
 * Holds the state of an active resize.
 */
export class ActiveResize extends AbstractNodeHandleBehavior<DragHandle> {
  private originalData: { width: number, height: number, x: number, y: number } | undefined;
  private dragStartPosition: { x: number, y: number } = {x: 0, y: 0};
  private originalTarget: UniversalGraphNode;


  constructor(graphView: CanvasGraphView,
              target: UniversalGraphNode,
              private size = 10) {
    super(graphView, target);
    this.originalTarget = cloneDeep(this.target);
  }

  isPointIntersectingNode(placedNode: PlacedNode, x: number, y: number): boolean {
    // Consider ourselves still intersecting if we have a handle
    return (!!this.handle || !!this.getHandleIntersected(placedNode, x, y)) ? true : undefined;
  }

  protected activeDragStart(event: MouseEvent, graphX: number, graphY: number, subject: GraphEntity | undefined) {
    this.originalData = {x: this.target.data.x, y: this.target.data.y, ...this.getCurrentNodeSize()};
    this.dragStartPosition = {x: graphX, y: graphY};
  }

  protected activeDrag(event: MouseEvent, graphX: number, graphY: number) {
    this.handle.execute(this.target, this.originalData, this.dragStartPosition, {x: graphX, y: graphY});
    this.graphView.invalidateNode(this.target);
    this.graphView.requestRender();
  }

  protected activeDragEnd(event: MouseEvent) {
    if (this.target.data.width !== this.originalTarget.data.width ||
      this.target.data.height !== this.originalTarget.data.height) {
      this.graphView.execute(new GraphEntityUpdate('Resize node', {
        type: GraphEntityType.Node,
        entity: this.target,
      }, {
        data: {
          width: this.target.data.width,
          height: this.target.data.height,
        },
      } as Partial<UniversalGraphNode>, {
        data: {
          width: this.originalTarget.data.width,
          height: this.originalTarget.data.height,
        },
      } as Partial<UniversalGraphNode>));
      this.originalTarget = cloneDeep(this.target);
    }
  }

  getHandleBoundingBoxes(placedNode: PlacedNode): DragHandle[] {
    const bbox = placedNode.getBoundingBox();
    const noZoomScale = 1 / this.graphView.transform.scale(1).k;
    const size = this.size * noZoomScale;
    const halfSize = size / 2;
    const handleDiagonal = Math.sqrt(2) * size;
    // const [x, y] = [placedNode.x, placedNode.y];
    // or
    const [x, y] = [(bbox.maxX + bbox.minX) / 2, (bbox.maxY + bbox.minY) / 2];
    // There is no handle on top: edge creation button is there.
    const sideMaker = (posX, posY, execute) => ({
      execute,
      minX: posX - halfSize,
      minY: posY - halfSize,
      maxX: posX + halfSize,
      maxY: posY + halfSize,
      displayColor: '#000000'
    });
    const handles = [
      // Right - one-dim scaling
      sideMaker(
        bbox.maxX,
        bbox.minY + (bbox.maxY - bbox.minY) / 2,
        (target, originalData, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.x - this.dragStartPosition.x) * noZoomScale;
          target.data.width = Math.abs(this.originalData.width + distance);
          target.data.x = this.originalData.x + distance / 2.0;
        }),
      // Left - one-dim scaling
      sideMaker(
        bbox.minX,
        bbox.minY + (bbox.maxY - bbox.minY) / 2,
        (target, originalSize, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.x - this.dragStartPosition.x) * noZoomScale;
          target.data.width = Math.abs(this.originalData.width - distance);
          target.data.x = this.originalData.x + distance / 2.0;
        }),
      // Bottom - one-dim scaling
      sideMaker(
        bbox.minX + (bbox.maxX - bbox.minX) / 2,
        bbox.maxY,
        (target, originalSize, dragStartPosition, graphPosition) => {
          const distance = (graphPosition.y - this.dragStartPosition.y) * noZoomScale;
          target.data.height = Math.abs(this.originalData.height + distance);
          target.data.y = this.originalData.y + distance / 2.0;
        }),
      // Top left
    ];
    // If node (currently: images) can be scaled uniformly, add those handles.
    if (placedNode.uniformlyResizable) {
      const execute = (target, originalSize, dragStartPosition, graphPosition) => {
        const ratio = this.originalData.width / this.originalData.height;
        const sizingVecLen = Math.hypot(graphPosition.x - x, graphPosition.y - y) - handleDiagonal / 2;
        const normY = Math.abs(sizingVecLen / Math.sqrt(ratio ** 2 + 1));
        target.data.width = 2 * normY * ratio;
        target.data.height = 2 * normY;
      };
      const cornerMaker = (posX, posY) => ({
        execute,
        minX: posX - halfSize,
        minY: posY - halfSize,
        maxX: posX + halfSize,
        maxY: posY + halfSize,
        displayColor: handleBlue
      });
      handles.push(
        cornerMaker(bbox.minX, bbox.minY), // Top left
        cornerMaker(bbox.minX, bbox.maxY), // Bottom left
        cornerMaker(bbox.maxX, bbox.maxY), // Bottom right
        cornerMaker(bbox.maxX, bbox.minY), // Top right
      );
    }
    return handles;
  }
}

interface DragHandle extends Handle {
  execute: (target: UniversalGraphNode,
            originalData: { width: number, height: number, x: number, y: number },
            dragStartPosition: { x: number, y: number },
            graphPosition: { x: number, y: number }) => void;
}
