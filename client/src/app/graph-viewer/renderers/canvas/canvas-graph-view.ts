import * as d3 from 'd3';
import { debounceTime, throttleTime } from 'rxjs/operators';
import { asyncScheduler, fromEvent, Subject, Subscription } from 'rxjs';

import {
  GraphEntity,
  GraphEntityType,
  UniversalEdgeStyle,
  UniversalGraph,
  UniversalGraphEdge, UniversalGraphEntity,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import {
  EdgeRenderStyle,
  NodeRenderStyle,
  PlacedEdge,
  PlacedNode,
} from 'app/graph-viewer/styles/styles';
import { nullCoalesce } from 'app/shared/utils/types';
import { LineEdge } from 'app/graph-viewer/utils/canvas/graph-edges/line-edge';
import { SolidLine } from 'app/graph-viewer/utils/canvas/lines/solid';

import { CanvasBehavior, DragBehaviorEvent, isStopResult } from '../behaviors';
import { PlacedObjectRenderTree } from './render-tree';
import { GraphView } from '../graph-view';


export interface CanvasGraphViewOptions {
  nodeRenderStyle: NodeRenderStyle;
  edgeRenderStyle: EdgeRenderStyle;
  backgroundFill?: string;
}

/**
 * A graph view that uses renders into a <canvas> tag.
 */
export class CanvasGraphView extends GraphView<CanvasBehavior> {
  // Options
  // ---------------------------------

  /**
   * Style used to render nodes.
   */
  nodeRenderStyle: NodeRenderStyle;

  /**
   * Style used to render edges.
   */
  edgeRenderStyle: EdgeRenderStyle;

  /**
   * The canvas background, if any.
   */
  backgroundFill: string | undefined = null;

  /**
   * The minimum interval in ms between renders to keep CPU down.
   */
  renderMinimumInterval = 15;

  /**
   * The maximum number of ms to spend drawing per every animation frame.
   */
  animationFrameRenderTimeBudget = 33; // 33 = 30fps

  // States
  // ---------------------------------

  /**
   * Keeps a handle on created renderers to improve performance.
   */
  readonly renderTree = new PlacedObjectRenderTree<UniversalGraphEntity>();

  /**
   * The next time to check to see if assets have been loaded.
   */
  protected nextAssetsLoadCheckTime: number | undefined = 0;

  /**
   * The transform represents the current zoom of the graph, which must be
   * taken into consideration whenever mapping between graph coordinates and
   * viewport coordinates.
   */
  protected d3Transform = d3.zoomIdentity;

  /**
   * Keeps track of where the drag started so we can ignore drags that are too short.
   */
  dragStartPosition: { x: number, y: number } | undefined;

  /**
   * The distance the user must move the mouse before a drag is actually started.
   */
  dragDistanceSqThreshold = Math.pow(3, 2);

  /**
   * Set to true once the drag distance threshold has been reached.
   */
  dragStarted = false;

  /**
   * The current position of the mouse (graph coordinates) if the user is
   * hovering over the canvas.
   */
  hoverPosition: { x: number, y: number } | undefined;

  /**
   * Keeps track of currently where the mouse (or finger) is held down at
   * so we can display an indicator at that position.
   */
  touchPosition: {
    position: { x: number, y: number },
    entity: GraphEntity | undefined,
  } | undefined;

  /**
   * Store the last time {@link zoomToFit} was called in case the canvas is
   * resized partly through a zoom, making the zoom operation almost useless.
   * This seems to happen a lot with Angular.
   */
  protected previousZoomToFitTime = 0;

  /**
   * Used in {@link setSize} when re-applying zoom-to-fit.
   */
  protected previousZoomToFitPadding = 0;

  /**
   * Keeps track of the time since last render to keep the number of
   * render cycles down.
   */
  protected previousRenderQueueCreationTime = 0;

  /**
   * Holds a queue of things to render to allow spreading rendering over several ticks.
   * Cleared when {@link requestRender} is called and re-created in {@link render}.
   */
  private renderQueue: IterableIterator<any>;

  // Events
  // ---------------------------------

  /**
   * Holds the ResizeObserver to detect resizes. Only set if
   * {@link startParentFillResizeListener} is called, but it may be
   * unset if {@link stopParentFillResizeListener} is called.
   */
  protected canvasResizeObserver: any | undefined; // TODO: TS does not have ResizeObserver defs yet

  /**
   * An observable triggered when resizes are detected.
   */
  canvasResizePendingSubject = new Subject<[number, number]>();

  /**
   * Holds subscriptions to remove when this component is removed.
   */
  private trackedSubscriptions: Subscription[] = [];

  /**
   * The subscription that handles the resizes.
   */
  protected canvasResizePendingSubscription: Subscription | undefined;

  // ========================================

  /**
   * Create an instance of this view.
   * @param canvas the backing <canvas> tag
   * @param options for the view
   */
  constructor(public canvas: HTMLCanvasElement, options: CanvasGraphViewOptions) {
    super();
    Object.assign(this, options);

    this.canvas = canvas;
    this.canvas.tabIndex = 0;
    // Many things break if the canvas dimensions become 0
    this.canvas.width = Math.max(1, this.canvas.clientWidth);
    this.canvas.height = Math.max(1, this.canvas.clientHeight);

    this.zoom = d3.zoom()
      .on('zoom', this.canvasZoomed.bind(this))
      .on('end', this.canvasZoomEnded.bind(this));

    // We use rxjs to limit the number of mousemove events
    const canvasMouseMoveSubject = new Subject<any>();

    d3.select(this.canvas)
      .on('click', this.canvasClicked.bind(this))
      .on('dblclick', this.canvasDoubleClicked.bind(this))
      .on('mousedown', this.canvasMouseDown.bind(this))
      .on('mousemove', () => {
        canvasMouseMoveSubject.next();
      })
      .on('dragover', () => {
        canvasMouseMoveSubject.next();
      })
      .on('focus', this.canvasFocused.bind(this))
      .on('blur', this.canvasBlurred.bind(this))
      .on('mouseleave', this.canvasMouseLeave.bind(this))
      .on('mouseup', this.canvasMouseUp.bind(this))
      .call(d3.drag()
        .container(this.canvas)
        .filter(() => !d3.event.button)
        .subject((): CanvasSubject => {
          if (this.behaviors.call('shouldDrag', {
            event: d3.event.sourceEvent,
          })) {
            return {
              entity: null,
            };
          }
          const entity = this.getEntityAtMouse();
          if (entity) {
            return {
              entity,
            };
          }
          return null;
        })
        .on('start', this.canvasDragStarted.bind(this))
        .on('drag', this.canvasDragged.bind(this))
        .on('end', this.canvasDragEnded.bind(this)))
      .call(this.zoom)
      .on('dblclick.zoom', null);

    this.trackedSubscriptions.push(
      canvasMouseMoveSubject
        .pipe(throttleTime(this.renderMinimumInterval, asyncScheduler, {
          leading: true,
          trailing: false,
        }))
        .subscribe(this.canvasMouseMoved.bind(this)),
    );

    this.trackedSubscriptions.push(
      fromEvent(this.canvas, 'keyup')
        .subscribe(this.canvasKeyDown.bind(this)),
    );

    // We already have callbacks for these events in the map-editor component, so these produce potentially redundant behavior. It's likely
    // there were plans to consolidate these that we never implemented. Disabling these for now to avoid undefined behavior.
    // this.trackedSubscriptions.push(
    //   fromEvent(this.canvas, 'dragover')
    //     .subscribe(this.canvasDragOver.bind(this)),
    // );

    // this.trackedSubscriptions.push(
    //   fromEvent(this.canvas, 'drop')
    //     .subscribe(this.canvasDrop.bind(this)),
    // );

    this.trackedSubscriptions.push(
      fromEvent(document, 'paste')
        .subscribe(this.documentPaste.bind(this)),
    );

    this.trackedSubscriptions.push(
      this.renderTree.renderRequest$.subscribe(objects => {
        this.requestRender();
      })
    );
  }

  destroy() {
    super.destroy();
    this.stopParentFillResizeListener();
    for (const subscription of this.trackedSubscriptions) {
      subscription.unsubscribe();
    }
  }

  startAnimationLoop() {
    // We can't render() every time something changes, because some events
    // happen very frequently when they do happen (i.e. mousemove),
    // so we'll flag a render as needed and render during an animation
    // frame to improve performance
    requestAnimationFrame(this.animationFrameFired.bind(this));
  }

  /**
   * Start a listener that will cause the canvas to fill its parent element
   * whenever the parent resizes. This method can be called more than once
   * and it will not re-subscribe.
   */
  startParentFillResizeListener() {
    if (this.canvasResizePendingSubscription) {
      return;
    }

    // Handle resizing of the canvas, but doing it with a throttled stream
    // so we don't burn extra CPU cycles resizing repeatedly unnecessarily
    this.canvasResizePendingSubscription = this.canvasResizePendingSubject
      .pipe(debounceTime(20, asyncScheduler))
      .subscribe(([width, height]) => {
        this.setSize(width, height);
      });
    const pushResize = () => {
      this.canvasResizePendingSubject.next([
        this.canvas.clientWidth,
        this.canvas.clientHeight,
      ]);
    };
    // @ts-ignore
    this.canvasResizeObserver = new window.ResizeObserver(pushResize);
    // TODO: Can we depend on ResizeObserver yet?
    this.canvasResizeObserver.observe(this.canvas.parentNode);
  }

  /**
   * Stop trying to resize the canvas to fit its parent node.
   */
  stopParentFillResizeListener() {
    if (this.canvasResizePendingSubscription) {
      this.canvasResizePendingSubscription.unsubscribe();
      this.canvasResizePendingSubscription = null;
    }
    if (this.canvasResizeObserver) {
      this.canvasResizeObserver.disconnect();
      this.canvasResizeObserver = null;
    }
  }

  setGraph(graph: UniversalGraph): void {
    super.setGraph(graph);
    this.renderTree.clear();
  }

  removeNode(node: UniversalGraphNode): { found: boolean; removedEdges: UniversalGraphEdge[] } {
    const result = super.removeNode(node);
    if (result.found) {
      this.renderTree.delete(node);
      for (const edge of result.removedEdges) {
        this.renderTree.delete(edge);
      }
    }
    return result;
  }

  removeEdge(edge: UniversalGraphEdge): boolean {
    const found = super.removeEdge(edge);
    if (found) {
      this.renderTree.delete(edge);
    }
    return found;
  }

  get width() {
    return this.canvas.width;
  }

  get height() {
    return this.canvas.height;
  }

  setSize(width: number, height: number) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      const centerX = this.transform.invertX(this.canvas.width / 2);
      const centerY = this.transform.invertY(this.canvas.height / 2);
      // If the canvas was barely shown, the zoom may be out of whack so we should force
      // a zoom to fit
      const canvasWasSmall = this.canvas.width <= 1 || this.canvas.height <= 1;
      // Many things break if the canvas dimensions become 0
      this.canvas.width = Math.max(1, width);
      this.canvas.height = Math.max(1, height);
      super.setSize(width, height);
      this.invalidateAll();
      if (window.performance.now() - this.previousZoomToFitTime < 500 || canvasWasSmall) {
        this.applyZoomToFit(0, this.previousZoomToFitPadding);
      } else {
        const newCenterX = this.transform.invertX(this.canvas.width / 2);
        const newCenterY = this.transform.invertY(this.canvas.height / 2);
        d3.select(this.canvas).call(
          this.zoom.translateBy,
          newCenterX - centerX,
          newCenterY - centerY,
        );
      }
    }
  }

  get transform() {
    return this.d3Transform;
  }

  get currentHoverPosition(): { x: number, y: number } | undefined {
    return this.hoverPosition;
  }

  placeNode(d: UniversalGraphNode): PlacedNode {
    let placedNode = this.renderTree.get(d) as PlacedNode;
    if (placedNode) {
      return placedNode;
    } else {
      const ctx = this.canvas.getContext('2d');

      placedNode = this.nodeRenderStyle.placeNode(d, ctx, {
        selected: this.isAnySelected(d),
        highlighted: this.isAnyHighlighted(d),
      });

      this.renderTree.set(d, placedNode);
      return placedNode;
    }
  }

  placeEdge(d: UniversalGraphEdge): PlacedEdge {
    let placedEdge = this.renderTree.get(d) as PlacedEdge;
    if (placedEdge) {
      return placedEdge;
    } else {
      const ctx = this.canvas.getContext('2d');
      const from = this.expectNodeByHash(d.from);
      const to = this.expectNodeByHash(d.to);
      const placedFrom: PlacedNode = this.placeNode(from);
      const placedTo: PlacedNode = this.placeNode(to);

      placedEdge = this.edgeRenderStyle.placeEdge(d, from, to, placedFrom, placedTo, ctx, {
        selected: this.isAnySelected(d, from, to),
        highlighted: this.isAnyHighlighted(d, from, to),
      });

      this.renderTree.set(d, placedEdge);

      return placedEdge;
    }
  }

  invalidateAll(): void {
    this.renderTree.clear();
  }

  /**
   * Invalidate any cache entries for the given node. If changes are made
   * that might affect how the node is rendered, this method must be called.
   * @param d the node
   */
  invalidateNode(d: UniversalGraphNode): void {
    this.renderTree.delete(d);
    for (const edge of this.edges) {
      if (edge.from === d.hash || edge.to === d.hash) {
        this.invalidateEdge(edge);
      }
    }
  }

  /**
   * Invalidate any cache entries for the given edge. If changes are made
   * that might affect how the edge is rendered, this method must be called.
   * @param d the edge
   */
  invalidateEdge(d: UniversalGraphEdge): void {
    this.renderTree.delete(d);
  }

  /**
   * Invalidate any cache entries for the given entity. Helper method
   * that calls the correct invalidation method.
   * @param entity the entity
   */
  invalidateEntity(entity: GraphEntity): void {
    if (entity.type === GraphEntityType.Node) {
      this.invalidateNode(entity.entity as UniversalGraphNode);
    } else if (entity.type === GraphEntityType.Edge) {
      this.invalidateEdge(entity.entity as UniversalGraphEdge);
    }
  }

  getLocationAtMouse(): [number, number] {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    const x = this.transform.invertX(mouseX);
    const y = this.transform.invertY(mouseY);
    return [x, y];
  }

  getEntityAtMouse(): GraphEntity | undefined {
    const [x, y] = this.getLocationAtMouse();
    return this.getEntityAtPosition(x, y);
  }

  /**
   * Graph look-up by position. Returns entity - or undefined. As multiple entities can be there,
   * we need to evaluate the click according to the display order:
   * Nodes > Edges > Images
   * @param x - x position
   * @param y - y position
   */
  getEntityAtPosition(x: number, y: number): GraphEntity | undefined {
    const node = this.getNodeAtPosition(this.nodes, x, y);
    // If the node is NOT an image, we return it
    if (node && node.label !== 'image') {
      return {
        type: GraphEntityType.Node,
        entity: node,
      };
    }
    const edge = this.getEdgeAtPosition(this.edges, x, y);
    if (edge) {
      return {
        type: GraphEntityType.Edge,
        entity: edge,
      };
    }
    // This node could only be image - as it is rendered below the edges, we need to
    // Check and return edge first
    if (node) {
      return {
        type: GraphEntityType.Node,
        entity: node,
      };
    }
    return undefined;
  }

  zoomToFit(duration: number = 1500, padding = 50) {
    this.previousZoomToFitTime = window.performance.now();
    this.applyZoomToFit(duration, padding);
  }

  panToEntity(e: GraphEntity, duration: number = 1500, padding = 50) {
    this.previousZoomToFitTime = window.performance.now();

    this.searchFocus.replace([e]);

    if (e.type === GraphEntityType.Edge) {
      // Pan to edge
      this.applyPanToEdge(e.entity as UniversalGraphEdge, duration, padding);
    } else {
      // Pan to node
      this.applyPanToNode(e.entity as UniversalGraphNode, duration, padding);
    }
  }

  private applyPanToEdge(
    edge: UniversalGraphEdge,
    duration: number = 1500,
    padding = 50,
  ) {
    this.previousZoomToFitPadding = padding;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    let select = d3.select(this.canvas);

    // Calling transition() causes a delay even if duration = 0
    if (duration > 0) {
      // @ts-ignore
      select = select.transition().duration(duration);
    }

    const from: UniversalGraphNode = this.nodeHashMap.get(edge.from);
    const to: UniversalGraphNode = this.nodeHashMap.get(edge.to);

    const {minX, minY, maxX, maxY} = this.getEdgeBoundingBox([edge], padding);

    const width = maxX - minX;
    const height = maxY - minY;

    select.call(
      this.zoom.transform,
      d3.zoomIdentity
        // move to center of canvas
        .translate(canvasWidth / 2, canvasHeight / 2)
        .scale(Math.max(1, Math.min(canvasWidth / width, canvasHeight / height)))
        // move to the midpoint of the edge
        .translate(
          -((from.data.x + to.data.x) / 2),
          -((from.data.y + to.data.y) / 2),
        ),
    );

    this.invalidateAll();
  }

  private applyPanToNode(node: UniversalGraphNode, duration: number = 1500, padding = 50) {
    this.previousZoomToFitPadding = padding;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    let select = d3.select(this.canvas);

    // Calling transition() causes a delay even if duration = 0
    if (duration > 0) {
      // @ts-ignore
      select = select.transition().duration(duration);
    }

    select.call(
      this.zoom.transform,
      d3.zoomIdentity
        // move to center of canvas
        .translate(canvasWidth / 2, canvasHeight / 2)
        .scale(2)
        .translate(-node.data.x, -node.data.y),
    );

    this.invalidateAll();
  }


  /**
   * The real zoom-to-fit.
   */
  private applyZoomToFit(duration: number = 1500, padding = 50) {
    this.previousZoomToFitPadding = padding;

    const canvasWidth = this.canvas.width;
    const canvasHeight = this.canvas.height;

    const {minX, minY, maxX, maxY} = this.getNodeBoundingBox(this.nodes, padding);
    const width = maxX - minX;
    const height = maxY - minY;

    let select = d3.select(this.canvas);

    // Calling transition() causes a delay even if duration = 0
    if (duration > 0) {
      // @ts-ignore
      select = select.transition().duration(duration);
    }

    select.call(
      this.zoom.transform,
      d3.zoomIdentity
        .translate(canvasWidth / 2, canvasHeight / 2)
        .scale(Math.min(1, Math.min(canvasWidth / width, canvasHeight / height)))
        .translate(-minX - width / 2, -minY - height / 2),
    );

    this.invalidateAll();
  }

  // ========================================
  // Rendering
  // ========================================

  focus() {
    this.canvas.focus();
  }

  focusEditorPanel() {
    this.editorPanelFocus$.next();
  }

  protected testAssetsLoaded() {
    const dummyText = '\uf279\uf1c1';
    const ctx = this.canvas.getContext('2d');
    ctx.font = `18px \'Dummy Lifelike Font ${Math.random()}\'`;
    const defaultMetrics = ctx.measureText(dummyText);
    ctx.font = '18px \'Font Awesome 5 Pro\'';
    const faMetrics = ctx.measureText(dummyText);
    for (const key of ['width', 'fontBoundingBoxAscent', 'hangingBaseline']) {
      if (defaultMetrics[key] !== faMetrics[key]) {
        return true;
      }
    }
    return false;
  }

  /**
   * Fired from requestAnimationFrame() and used to render the graph
   * in the background as necessary.
   */
  animationFrameFired() {
    if (!this.active) {
      // Happens when this component is destroyed
      return;
    }

    const now = window.performance.now();

    // Keep re-rendering until Font Awesome has loaded
    if (this.nextAssetsLoadCheckTime != null && this.nextAssetsLoadCheckTime < now) {
      const loaded = this.testAssetsLoaded();
      if (loaded) {
        this.nextAssetsLoadCheckTime = null;
      } else {
        this.nextAssetsLoadCheckTime = now + 1000;
      }
      this.requestRender();
    }

    // Instead of rendering on every animation frame, we keep track of a flag
    // that gets set to true whenever the graph changes and so we need to re-draw it
    if (this.renderingRequested) {
      // But even then, we'll still throttle the number of times we restart rendering
      // in case the flag is set to true too frequently in a period
      if (now - this.previousRenderQueueCreationTime > this.renderMinimumInterval) {
        this.emptyCanvas(); // Clears canvas

        // But we actually won't necessarily render the whole graph at once: we'll
        // build a queue of things to render and render the graph in batches,
        // limiting the amount we render in a batch so we never exceed our
        // expected FPS
        this.renderQueue = this.generateRenderQueue();

        // Reset flags so we don't do this again until a render is requested
        this.renderingRequested = false;
        this.previousRenderQueueCreationTime = now;
      }
    }

    // It looks like we have a list of things we need to render, so let's
    // work through it and draw as much as possible until we hit the 'render time budget'
    if (this.renderQueue) {
      const startTime = window.performance.now();

      // ctx.save(), ctx.translate(), ctx.scale()
      this.startCurrentRenderBatch();

      while (true) {
        const result = this.renderQueue.next();

        if (result.done) {
          // Finished rendering!
          this.renderQueue = null;
          break;
        }

        // Check render time budget and abort
        // We'll get back to this point on the next animation frame
        if (window.performance.now() - startTime > this.animationFrameRenderTimeBudget) {
          break;
        }
      }

      // ctx.restore()
      this.endCurrentRenderBatch();
    }

    // Need to call this every time so we keep running
    requestAnimationFrame(this.animationFrameFired.bind(this));
  }

  render() {
    // Since we're rendering in one shot, clear any queue that we may have started
    this.renderQueue = null;

    // Clears canvas
    this.emptyCanvas();

    // ctx.save(), ctx.translate(), ctx.scale()
    this.startCurrentRenderBatch();

    // Render everything in the queue all at once
    const queue = this.generateRenderQueue();
    while (true) {
      const result = queue.next();
      if (result.done) {
        break;
      }
    }

    // ctx.save()
    this.endCurrentRenderBatch();
  }

  /**
   * Clears the canvas for a brand new render.
   */
  private emptyCanvas() {
    const canvas = this.canvas;
    const ctx = canvas.getContext('2d');

    if (this.backgroundFill) {
      ctx.fillStyle = this.backgroundFill;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /**
   * Save the context and set the canvas transform. Call this before performing
   * any draw actions during a render batch. Note that a render consists of one or
   * more batches, so call this method for EVERY batch.
   */
  private startCurrentRenderBatch() {
    const ctx = this.canvas.getContext('2d');

    ctx.save();
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(this.transform.k, this.transform.k);
  }

  /**
   * Restore the context. Call this after performing any draw actions
   * during a render. Note that a render consists of one or more batches, so call
   * this method for EVERY batch.
   */
  private endCurrentRenderBatch() {
    const ctx = this.canvas.getContext('2d');

    ctx.restore();

    this.updateMouseCursor();
  }

  /**
   * Builds an iterable that will draw the graph. Before
   * actually iterating through, first call {@link startCurrentRenderBatch} at the
   * start of every rendering batch and then at the end of any batch,
   * call {@link endCurrentRenderBatch}.
   */
  * generateRenderQueue() {
    const ctx = this.canvas.getContext('2d');

    yield* this.drawTouchPosition(ctx);
    yield* this.drawSelectionBackground(ctx);
    yield* this.drawLayoutGroups(ctx);
    yield* this.drawEdges(ctx);
    yield* this.drawNodes(ctx);
    yield* this.drawHighlightBackground(ctx);
    yield* this.drawSearchHighlightBackground(ctx);
    yield* this.drawSearchFocusBackground(ctx);
    yield* this.drawActiveBehaviors(ctx);
  }

  private* drawTouchPosition(ctx: CanvasRenderingContext2D) {
    yield null;

    if (this.touchPosition) {
      const noZoomScale = 1 / this.transform.scale(1).k;
      const touchPositionEntity = this.touchPosition.entity;

      // Either we highlight the 'touched entity' if we have one (because the user just
      // touched one), otherwise we draw something at the mouse coordinates
      if (touchPositionEntity != null) {
        this.drawEntityBackground(ctx, touchPositionEntity, 'rgba(0, 0, 0, 0.075)');
      } else {
        ctx.beginPath();
        ctx.arc(this.touchPosition.position.x, this.touchPosition.position.y, 20 * noZoomScale, 0, 2 * Math.PI, false);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.075)';
        ctx.fill();
      }
    }
  }

  private* drawHighlightBackground(ctx: CanvasRenderingContext2D) {
    yield null;

    ctx.save();
    const highlighted = this.highlighting.get();
    for (const highlightedEntity of highlighted) {
      this.drawEntityHighlightBox(ctx, highlightedEntity, false);
    }
    ctx.restore();
  }

  private* drawSelectionBackground(ctx: CanvasRenderingContext2D) {
    yield null;

    const selected = this.selection.get();
    for (const selectedEntity of selected) {
      this.drawEntityBackground(ctx, selectedEntity, 'rgba(0, 0, 0, 0.075)');
    }
  }

  private* drawSearchHighlightBackground(ctx: CanvasRenderingContext2D) {
    yield null;

    if (!this.touchPosition) {
      const highlighted = this.searchHighlighting.get();
      for (const highlightedEntity of highlighted) {
        this.drawEntityHighlightBox(ctx, highlightedEntity, false);
      }
    }
  }

  private* drawSearchFocusBackground(ctx: CanvasRenderingContext2D) {
    yield null;

    if (!this.touchPosition) {
      const focus = this.searchFocus.get();
      for (const focusEntity of focus) {
        this.drawEntityHighlightBox(ctx, focusEntity, true);
      }
    }
  }

  private* drawLayoutGroups(ctx: CanvasRenderingContext2D) {
    yield null;

    // TODO: This is currently only for demo
    for (const d of this.layoutGroups) {
      if (d.leaves.length) {
        ctx.beginPath();
        const bbox = this.getNodeBoundingBox(d.leaves.map(entry => entry.reference), 10);
        ctx.fillStyle = d.color;
        ctx.strokeStyle = d.color;
        ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
        ctx.globalAlpha = 0.1;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      }
    }
  }

  private* drawEdges(ctx: CanvasRenderingContext2D) {
    yield null;

    const transform = this.transform;
    const placeEdge = this.placeEdge.bind(this);

    // We need to turn edges into PlacedEdge objects before we can render them,
    // but the process involves calculating various metrics, which we don't
    // want to do more than once if we need to render in multiple Z-layers (line + text)
    const edgeRenderObjects = [];

    for (const d of this.edges) {
      yield null;
      edgeRenderObjects.push({
        d,
        placedEdge: placeEdge(d),
      });
    }

    for (const {d, placedEdge} of edgeRenderObjects) {
      yield null;
      placedEdge.draw(transform);
    }

    for (const {d, placedEdge} of edgeRenderObjects) {
      yield null;
      placedEdge.drawLayer2(transform);
    }
  }

  private* drawNodes(ctx: CanvasRenderingContext2D) {
    for (const d of this.nodes) {
      yield null;
      ctx.beginPath();
      this.placeNode(d).draw(this.transform);
    }
  }

  private* drawActiveBehaviors(ctx: CanvasRenderingContext2D) {
    for (const behavior of this.behaviors.getBehaviors()) {
      yield null;
      behavior.draw(ctx, this.transform);
    }
  }

  /**
   * Update the current mouse cursor.
   */
  updateMouseCursor() {
  }

  /**
   * Draw a red box around the entity.
   */
  private drawEntityHighlightBox(ctx: CanvasRenderingContext2D, entity: GraphEntity, strong: boolean) {
    if (entity.type === GraphEntityType.Edge) {
      const d = entity.entity as UniversalGraphEdge;
      const from = this.expectNodeByHash(d.from);
      const to = this.expectNodeByHash(d.to);
      const placedFrom: PlacedNode = this.placeNode(from);
      const placedTo: PlacedNode = this.placeNode(to);

      const [toX, toY] = placedTo.lineIntersectionPoint(from.data.x, from.data.y);
      const [fromX, fromY] = placedFrom.lineIntersectionPoint(to.data.x, to.data.y);

      const styleData: UniversalEdgeStyle = nullCoalesce(d.style, {});
      const lineWidthScale = nullCoalesce(styleData.lineWidthScale, 1);
      const lineWidth = lineWidthScale * 1 + 20;

      (new LineEdge(ctx, {
        source: {
          x: fromX,
          y: fromY,
        },
        target: {
          x: toX,
          y: toY,
        },
        stroke: new SolidLine(lineWidth, `rgba(255, 0, 0, ${strong ? 0.4 : 0.2})`, {
          lineCap: 'square',
        }),
        forceHighDetailLevel: true,
      })).draw(this.transform);
    } else {
      const lineWidth = strong ? 5 : 3;

      ctx.beginPath();
      const bbox = this.getEntityBoundingBox([entity], 10);
      ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
      ctx.strokeStyle = 'rgba(255, 0, 0, 255)';
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'butt';
      if (!strong) {
        ctx.globalAlpha = 0.4;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /**
   * Draw a selection around the entity.
   */
  private drawEntityBackground(ctx: CanvasRenderingContext2D, entity: GraphEntity,
                               fillColor: string) {
    if (entity.type === GraphEntityType.Edge) {
      const d = entity.entity as UniversalGraphEdge;
      const from = this.expectNodeByHash(d.from);
      const to = this.expectNodeByHash(d.to);
      const placedFrom: PlacedNode = this.placeNode(from);
      const placedTo: PlacedNode = this.placeNode(to);

      const [toX, toY] = placedTo.lineIntersectionPoint(from.data.x, from.data.y);
      const [fromX, fromY] = placedFrom.lineIntersectionPoint(to.data.x, to.data.y);

      const styleData: UniversalEdgeStyle = nullCoalesce(d.style, {});
      const lineWidthScale = nullCoalesce(styleData.lineWidthScale, 1);
      const lineWidth = lineWidthScale * 1 + 20;

      (new LineEdge(ctx, {
        source: {
          x: fromX,
          y: fromY,
        },
        target: {
          x: toX,
          y: toY,
        },
        stroke: new SolidLine(lineWidth, fillColor, {
          lineCap: 'square',
        }),
        forceHighDetailLevel: true,
      })).draw(this.transform);
    } else {
      ctx.beginPath();
      const bbox = this.getEntityBoundingBox([entity], 10);
      ctx.rect(bbox.minX, bbox.minY, bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
  }

  // ========================================
  // Event handlers
  // ========================================

  canvasKeyDown(event) {
    const behaviorEvent = {
      event,
    };
    if (isStopResult(this.behaviors.apply(behavior => behavior.keyDown(behaviorEvent)))) {
      event.preventDefault();
    }
  }

  canvasClicked() {
    const behaviorEvent = {
      event: d3.event,
    };
    this.behaviors.apply(behavior => behavior.click(behaviorEvent));
  }

  canvasDoubleClicked() {
    const behaviorEvent = {
      event: d3.event,
    };
    this.behaviors.apply(behavior => behavior.doubleClick(behaviorEvent));
  }

  canvasMouseDown() {
    this.mouseDown = true;
  }

  canvasMouseMoved() {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    const graphX = this.transform.invertX(mouseX);
    const graphY = this.transform.invertY(mouseY);
    const entityAtMouse = this.getEntityAtPosition(graphX, graphY);

    this.hoverPosition = {x: graphX, y: graphY};

    const behaviorEvent = {
      event: d3.event,
    };
    this.behaviors.apply(behavior => behavior.mouseMove(behaviorEvent));

    if (this.mouseDown) {
      this.touchPosition = {
        position: {
          x: graphX,
          y: graphY,
        },
        entity: null,
      };

      this.requestRender();
    }

    this.updateMouseCursor();
  }

  canvasFocused() {
    this.requestRender();
  }

  canvasBlurred() {
    this.requestRender();
  }

  canvasMouseLeave() {
    this.hoverPosition = null;
  }

  canvasMouseUp() {
    this.mouseDown = false;
    this.touchPosition = null;
    this.requestRender();
  }

  // See the comment in the constructor above regarding these callbacks. Disabling for now to avoid undefined behavior.
  // canvasDragOver(event): void {
  //   const behaviorEvent = {
  //     // event,
  //     event: d3.event,
  //   };
  //   this.behaviors.apply(behavior => behavior.dragOver(behaviorEvent));
  // }

  // canvasDrop(event): void {
  //   console.log('canvasDrop');
  //   const behaviorEvent = {
  //     // event,
  //     event: d3.event,
  //   };
  //   this.behaviors.apply(behavior => behavior.drop(behaviorEvent));
  // }

  documentPaste(event): void {
    const behaviorEvent = {
      event,
    };
    this.behaviors.apply(behavior => behavior.paste(behaviorEvent));
  }

  canvasDragStarted(): void {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    this.dragStartPosition = {x: mouseX, y: mouseY};
    this.dragStarted = false;

    const subject: CanvasSubject = d3.event.subject;
    const behaviorEvent: DragBehaviorEvent = {
      event: d3.event.sourceEvent,
      entity: subject.entity,
    };

    this.behaviors.apply(behavior => behavior.dragStart(behaviorEvent));

    this.touchPosition = {
      position: {
        x: this.transform.invertX(mouseX),
        y: this.transform.invertY(mouseY),
      },
      entity: subject.entity,
    };

    this.requestRender();
  }

  canvasDragged(): void {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    let dragStarted = this.dragStarted;

    if (!dragStarted) {
      const distanceSq = Math.pow(mouseX - this.dragStartPosition.x, 2)
        + Math.pow(mouseY - this.dragStartPosition.y, 2);
      dragStarted = distanceSq >= this.dragDistanceSqThreshold;
    }

    if (dragStarted) {
      try {
        const subject: CanvasSubject = d3.event.subject;
        const behaviorEvent: DragBehaviorEvent = {
          event: d3.event.sourceEvent,
          entity: subject.entity,
        };

        this.behaviors.apply(behavior => behavior.drag(behaviorEvent));

        this.touchPosition = {
          position: {
            x: this.transform.invertX(mouseX),
            y: this.transform.invertY(mouseY),
          },
          entity: subject.entity,
        };

        this.requestRender();
      } finally {
        this.dragStarted = true;
      }
    }
  }

  canvasDragEnded(): void {
    const subject: CanvasSubject = d3.event.subject;
    const behaviorEvent: DragBehaviorEvent = {
      event: d3.event.sourceEvent,
      entity: subject.entity,
    };

    this.behaviors.apply(behavior => behavior.dragEnd(behaviorEvent));
    this.nodePositionOverrideMap.clear();
    this.mouseDown = false;
    this.touchPosition = null;
    this.requestRender();
  }

  canvasZoomed(): void {
    const [mouseX, mouseY] = d3.mouse(this.canvas);
    this.d3Transform = d3.event.transform;
    this.panningOrZooming = true;
    this.touchPosition = {
      position: {
        x: this.transform.invertX(mouseX),
        y: this.transform.invertY(mouseY),
      },
      entity: null,
    };
    this.requestRender();
  }

  canvasZoomEnded(): void {
    this.panningOrZooming = false;
    this.touchPosition = null;
    this.mouseDown = false;
    this.requestRender();
  }
}

interface CanvasSubject {
  entity: GraphEntity | undefined;
}
