import * as d3 from 'd3';
import { Subject } from 'rxjs';
import * as cola from 'webcola';
import { InputNode, Layout } from 'webcola';
import { Group, Link } from 'webcola/WebCola/src/layout';

import {
  GraphEntity,
  GraphEntityType, Hyperlink, Source,
  UniversalGraph,
  UniversalGraphEdge,
  UniversalGraphEntity,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { emptyIfNull } from 'app/shared/utils/types';
import { compileFind, FindOptions } from 'app/shared/utils/find';
import {associatedMapsRegex} from 'app/shared/constants';

import { PlacedEdge, PlacedNode, PlacedObject } from '../styles/styles';
import { GraphAction, GraphActionReceiver } from '../actions/actions';
import { Behavior, BehaviorList } from './behaviors';
import { CacheGuardedEntityList } from '../utils/cache-guarded-entity-list';
import { RenderTree } from './render-tree';

/**
 * A rendered view of a graph.
 */
export abstract class GraphView<BT extends Behavior> implements GraphActionReceiver {
  /**
   * Set to false when the component is destroyed so we can stop rendering.
   */
  protected active = true;

  /**
   * Collection of nodes displayed on the graph. This is not a view --
   * it is a direct copy of nodes being rendered.
   */
  nodes: UniversalGraphNode[] = [];

  /**
   * Collection of nodes displayed on the graph. This is not a view --
   * it is a direct copy of edges being rendered.
   */
  edges: UniversalGraphEdge[] = [];

  /**
   * Collection of layout groups on the graph.
   */
  layoutGroups: GraphLayoutGroup[] = [];

  /**
   * Maps node's hashes to nodes for O(1) lookup, essential to the speed
   * of most of this graph code.
   */
  protected nodeHashMap: Map<string, UniversalGraphNode> = new Map();

  /**
   * Keep track of fixed X/Y positions that come from dragging nodes. These
   * values are passed to the automatic layout routines .
   */
  readonly nodePositionOverrideMap: Map<UniversalGraphNode, [number, number]> = new Map();

  /**
   * Stores the counters for linked documents
   */
  linkedDocuments: Set<string> = new Set();

  // Graph states
  // ---------------------------------

  /**
   * Marks that changes to the view were made so we need to re-render.
   */
  protected renderingRequested = false;

  abstract renderTree: RenderTree;

  /**
   * Indicates where a mouse button is currently down.
   */
  mouseDown = false;

  /**
   * d3-zoom object used to handle zooming.
   */
  protected zoom: any;

  /**
   * webcola object used for automatic layout.
   * Initialized in {@link ngAfterViewInit}.
   */
  cola: Layout;

  /**
   * Indicates whether we are panning or zooming.
   */
  panningOrZooming = false;

  /**
   * Holds the currently highlighted node or edge.
   */
  readonly highlighting = new CacheGuardedEntityList(this);

  /**
   * Holds the currently selected node or edge.
   */
  readonly selection = new CacheGuardedEntityList(this);

  /**
   * Holds the currently dragged node or edge.
   */
  readonly dragging = new CacheGuardedEntityList(this);

  /**
   * Holds the nodes and edges for search highlighting
   */
  readonly searchHighlighting = new CacheGuardedEntityList(this);
  readonly searchFocus = new CacheGuardedEntityList(this);

  /**
   * Whether nodes are arranged automatically.
   */
  automaticLayoutEnabled = false;

  /**
   * Holds currently active behaviors. Behaviors provide UI for the graph.
   */
  readonly behaviors = new BehaviorList<BT>([
    'isPointIntersectingNode',
    'isPointIntersectingEdge',
    'isBBoxEnclosingNode',
    'isBBoxEnclosingEdge',
    'shouldDrag',
  ]);

  // History
  // ---------------------------------

  /**
   * Stack of actions in the history.
   */
  history: GraphAction[] = [];

  /**
   * Stores where we are in the history, where the number is the next free index
   * in the history array if there is nothing to redo/rollback. When the user
   * calls undo(), the index goes -1 and when the user calls redo(), the index
   * goes +1.
   */
  protected nextHistoryIndex = 0;

  /**
   * Stream of events when history changes in any way.
   */
  historyChanges$ = new Subject<any>();

  /**
   * Stream of events when a graph entity needs to be focused.
   */
  editorPanelFocus$ = new Subject<any>();

  /**
   * Defines how close to the node we have to click to terminate the node search early.
   */
  readonly MIN_NODE_DISTANCE = 6.0;


  constructor() {
    this.cola = cola
      .d3adaptor(d3)
      .on('tick', this.colaTicked.bind(this))
      .on('end', this.colaEnded.bind(this));
  }

  /**
   * Start the background loop that updates the animation. If calling
   * this from Angular, use ngZone.runOutsideAngular() to call this method.
   */
  abstract startAnimationLoop();

  /**
   * Remove any hooks that have been created.
   */
  destroy() {
    this.active = false;
    this.behaviors.destroy();
  }

  // ========================================
  // Graph
  // ========================================

  /**
   * Get the width of the view.
   */
  abstract get width();

  /**
   * Get the height of the view.
   */
  abstract get height();

  /**
   * Set the size of the canvas. Call this method if the backing element
   * (i.e. the <canvas> changes size).
   * @param width the new width
   * @param height the new height
   */
  setSize(width: number, height: number) {
    this.requestRender();
  }

  // TODO: Move
  /**
   * Iterate through the link nodes of the GraphEntity and return hashes to linked documents/ET
   * @params links: list to check
   * @returns: list of hashes found in the links
   */
  getLinkedHashes(links: (Source | Hyperlink)[]): string[] {
    // Filter in links that point to desired files
    return links.filter((source) => {
      return associatedMapsRegex.test(source.url);
    // Return hashId of those files (last element of the url address)
    }).map(source => {
      return associatedMapsRegex.exec(source.url)[1];
    });
  }

  /**
   * Check the Entity for links to internal files
   * @param entity: UniversalGraphEntity that we are checking
   */
  checkEntityForLinked(entity: UniversalGraphEntity): Set<string> {
    // NOTE: Should I check only sources?
    if (entity.data) {
      const linkedInHyperlinks = entity.data.hyperlinks ? this.getLinkedHashes(entity.data.hyperlinks) : [];
      const linkedInSources = entity.data.sources ? this.getLinkedHashes(entity.data.sources) : [];
      return new Set(linkedInHyperlinks.concat(linkedInSources));
    }
    return new Set();
  }

  /**
   * Check the entire graph for any linked documents/enrichment tables and return a set of their hashes
   */
  getHashesOfLinked(): Set<string> {
    const set = new Set<string>();
    // Note: Should I check only nodes?
    this.nodes.forEach(node => this.checkEntityForLinked(node).forEach(val => set.add(val)));
    this.edges.forEach(edge => this.checkEntityForLinked(edge).forEach(val => set.add(val)));
    return set;
  }

  /**
   * Replace the graph that is being rendered by the drawing tool.
   * @param graph the graph to replace with
   */
  // NOTE: This is actually called twice when opening a map in read-only mode - is this anticipated?
  setGraph(graph: UniversalGraph): void {
    // TODO: keep or nah?
    this.nodes = [...graph.nodes];
    this.edges = [...graph.edges];

    // We need O(1) lookup of nodes
    this.nodeHashMap = graph.nodes.reduce(
      (map, node) => map.set(node.hash, node),
      new Map(),
    );

    this.nodePositionOverrideMap.clear();

    this.requestRender();
  }

  /**
   * Return a copy of the graph.
   */
  getGraph(): UniversalGraph {
    return {
      nodes: this.nodes,
      edges: this.edges,
    };
  }

  /**
   * Add the given node to the graph.
   * @param node the node
   */
  addNode(node: UniversalGraphNode): void {
    if (this.nodeHashMap.has(node.hash)) {
      throw new Error('trying to add a node that already is in the node list is bad');
    }
    this.nodes.push(node);
    this.nodeHashMap.set(node.hash, node);
    this.requestRender();
  }

  /**
   * Remove the given node from the graph.
   * @param node the node
   * @return true if the node was found
   */
  removeNode(node: UniversalGraphNode): {
    found: boolean,
    removedEdges: UniversalGraphEdge[],
  } {
    const removedEdges = [];
    let foundNode = false;

    let i = this.nodes.length;
    while (i--) {
      if (this.nodes[i] === node) {
        this.nodes.splice(i, 1);
        foundNode = true;
        break;
      }
    }

    let j = this.edges.length;
    while (j--) {
      const edge = this.edges[j];
      if (this.expectNodeByHash(edge.from) === node
        || this.expectNodeByHash(edge.to) === node) {
        removedEdges.push(edge);
        this.edges.splice(j, 1);
      }
    }

    this.nodeHashMap.delete(node.hash);
    this.invalidateNode(node);

    // TODO: Only adjust selection if needed
    this.selection.replace([]);
    this.dragging.replace([]);
    this.highlighting.replace([]);
    this.requestRender();

    return {
      found: foundNode,
      removedEdges,
    };
  }

  /**
   * Mark the node as being updated.
   * @param node the node
   */
  updateNode(node: UniversalGraphNode): void {
    this.invalidateNode(node);
  }

  /**
   * Add the given edge to the graph.
   * @param edge the edge
   */
  addEdge(edge: UniversalGraphEdge): void {
    const from = this.expectNodeByHash(edge.from);
    const to = this.expectNodeByHash(edge.to);
    this.edges.push(edge);
    this.invalidateNode(from);
    this.invalidateNode(to);
  }

  /**
   * Remove the given edge from the graph.
   * @param edge the edge
   * @return true if the edge was found
   */
  removeEdge(edge: UniversalGraphEdge): boolean {
    let foundNode = false;
    const from = this.expectNodeByHash(edge.from);
    const to = this.expectNodeByHash(edge.to);

    let j = this.edges.length;
    while (j--) {
      if (this.edges[j] === edge) {
        this.edges.splice(j, 1);
        foundNode = true;
        break;
      }
    }

    this.invalidateNode(from);
    this.invalidateNode(to);

    // TODO: Only adjust selection if needed
    this.selection.replace([]);
    this.dragging.replace([]);
    this.highlighting.replace([]);

    this.requestRender();

    return foundNode;
  }

  /**
   * Mark the edge as being updated.
   * @param edge the node
   */
  updateEdge(edge: UniversalGraphEdge): void {
    this.invalidateEdge(edge);
    this.requestRender();
  }

  /**
   * Invalidate the whole renderer cache.
   */
  invalidateAll(): void {
  }

  /**
   * Invalidate any cache entries for the given node. If changes are made
   * that might affect how the node is rendered, this method must be called.
   * @param d the node
   */
  invalidateNode(d: UniversalGraphNode): void {
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
  }

  /**
   * Get all nodes and edges that match some search terms.
   * @param terms the terms
   * @param options addiitonal find options
   */
  findMatching(terms: string[], options: FindOptions = {}): GraphEntity[] {
    const matcher = compileFind(terms, options);
    const matches: GraphEntity[] = [];

    for (const node of this.nodes) {
      const data: { detail?: string } = node.data != null ? node.data : {};
      const text = (emptyIfNull(node.display_name) + ' ' + emptyIfNull(data.detail)).toLowerCase();

      if (matcher(text)) {
        matches.push({
          type: GraphEntityType.Node,
          entity: node,
        });
      }
    }

    for (const edge of this.edges) {
      const data: { detail?: string } = edge.data != null ? edge.data : {};
      const text = (emptyIfNull(edge.label) + ' ' + emptyIfNull(data.detail)).toLowerCase();
      if (matcher(text)) {
        matches.push({
          type: GraphEntityType.Edge,
          entity: edge,
        });
      }
    }

    return matches;
  }

  /**
   * Get the current position (graph coordinates) where the user is currently
   * hovering over if the user is doing so, otherwise undefined.
   */
  abstract get currentHoverPosition(): { x: number, y: number } | undefined;

  // ========================================
  // Object accessors
  // ========================================

  /**
   * Get the bounding box containing all the given entities.
   * @param entities the entities to check
   * @param padding padding around all the entities
   */
  getEntityBoundingBox(entities: GraphEntity[], padding = 0) {
    return this.getGroupBoundingBox(entities.map(entity => this.placeEntity(entity).getBoundingBox()), padding);
  }

  /**
   * Get the bounding box containing all the given nodes.
   * @param nodes the nodes to check
   * @param padding padding around all the nodes
   */
  getNodeBoundingBox(nodes: UniversalGraphNode[], padding = 0) {
    return this.getGroupBoundingBox(nodes.map(node => this.placeNode(node).getBoundingBox()), padding);
  }

  /**
   * Get the bounding box containing all the given edges.
   * @param edges the edges to check
   * @param padding padding around all the edges
   */
  getEdgeBoundingBox(edges: UniversalGraphEdge[], padding = 0) {
    return this.getGroupBoundingBox(edges.map(edge => this.placeEdge(edge).getBoundingBox()), padding);
  }

  /**
   * Get the bounding box containing all the given bounding boxes.
   * @param boundingBoxes bounding boxes to check
   * @param padding padding around all the bounding boxes
   */
  getGroupBoundingBox(boundingBoxes: { minX: number, maxX: number, minY: number, maxY: number }[],
                      padding = 0) {
    let minX = null;
    let minY = null;
    let maxX = null;
    let maxY = null;

    for (const bbox of boundingBoxes) {
      if (minX === null || minX > bbox.minX + padding) {
        minX = bbox.minX - padding;
      }
      if (minY === null || minY > bbox.minY + padding) {
        minY = bbox.minY - padding;
      }
      if (maxX === null || maxX < bbox.maxX + padding) {
        maxX = bbox.maxX + padding;
      }
      if (maxY === null || maxY < bbox.maxY + padding) {
        maxY = bbox.maxY + padding;
      }
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
    };
  }

  /**
   * Grab the node referenced by the given hash.
   * @param hash the hash
   */
  getNodeByHash(hash: string): UniversalGraphNode | undefined {
    return this.nodeHashMap.get(hash);
  }

  /**
   * Grab the node referenced by the given hash. Throws an error if not found.
   * @param hash the hash
   */
  expectNodeByHash(hash: string): UniversalGraphNode {
    const node = this.getNodeByHash(hash);
    if (node == null) {
      throw new Error('missing node link');
    }
    return node;
  }

  /**
   * Find the best matching node at the given position.
   * @param nodes list of nodes to search through
   * @param x graph X location
   * @param y graph Y location
   */
  getNodeAtPosition(nodes: UniversalGraphNode[], x: number, y: number): UniversalGraphNode | undefined {
    const possibleNodes = [];
    for (let i = nodes.length - 1; i >= 0; --i) {
      const d = nodes[i];
      const placedNode = this.placeNode(d);
      const hookResult = this.behaviors.call('isPointIntersectingNode', placedNode, x, y);
      if ((hookResult !== undefined && hookResult) || placedNode.isPointIntersecting(x, y)) {
        const distance = Math.hypot(x - d.data.x, y - d.data.y);
        // Node is so close, that we are sure it is it. Terminate early.
        if (distance <= this.MIN_NODE_DISTANCE) {
          return d;
        }
        possibleNodes.push({
          node: d,
          distance
        });

      }
    }
    if (possibleNodes.length === 0) {
      return undefined;
    }
    possibleNodes.sort((a, b) => {
      return a.distance - b.distance;
    });
    return possibleNodes[0].node;
  }

  /**
   * Find the best matching edge at the given position.
   * @param edges list of edges to search through
   * @param x graph X location
   * @param y graph Y location
   */
  getEdgeAtPosition(edges: UniversalGraphEdge[], x: number, y: number): UniversalGraphEdge | undefined {
    let bestCandidate: { edge: UniversalGraphEdge, distanceUnsq: number } = null;
    const distanceUnsqThreshold = 5 * 5;

    for (const d of edges) {
      const placedEdge = this.placeEdge(d);

      const hookResult = this.behaviors.call('isPointIntersectingEdge', placedEdge, x, y);
      if ((hookResult !== undefined && hookResult) || placedEdge.isPointIntersecting(x, y)) {
        return d;
      }

      const distanceUnsq = placedEdge.getPointDistanceUnsq(x, y);
      if (distanceUnsq <= distanceUnsqThreshold) {
        if (bestCandidate == null || bestCandidate.distanceUnsq >= distanceUnsq) {
          bestCandidate = {
            edge: d,
            distanceUnsq,
          };
        }
      }
    }

    if (bestCandidate != null) {
      return bestCandidate.edge;
    }

    return undefined;
  }

  /**
   * Find all the nodes fully enclosed by the bounding box.
   * @param nodes list of nodes to search through
   * @param x0 top left
   * @param y0 top left
   * @param x1 bottom right
   * @param y1 bottom right
   */
  getNodesWithinBBox(nodes: UniversalGraphNode[], x0: number, y0: number, x1: number, y1: number): UniversalGraphNode[] {
    const results = [];
    for (let i = nodes.length - 1; i >= 0; --i) {
      const d = nodes[i];
      const placedNode = this.placeNode(d);
      const hookResult = this.behaviors.call('isBBoxEnclosingNode', placedNode, x0, y0, x1, y1);
      if ((hookResult !== undefined && hookResult) || placedNode.isBBoxEnclosing(x0, y0, x1, y1)) {
        results.push(d);
      }
    }
    return results;
  }

  /**
   * Find all the edges fully enclosed by the bounding box.
   * @param edges list of edges to search through
   * @param x0 top left
   * @param y0 top left
   * @param x1 bottom right
   * @param y1 bottom right
   */
  getEdgesWithinBBox(edges: UniversalGraphEdge[], x0: number, y0: number, x1: number, y1: number): UniversalGraphEdge[] {
    const results = [];
    for (let i = edges.length - 1; i >= 0; --i) {
      const d = edges[i];
      const placedEdge = this.placeEdge(d);
      const hookResult = this.behaviors.call('isBBoxEnclosingEdge', placedEdge, x0, y0, x1, y1);
      if ((hookResult !== undefined && hookResult) || placedEdge.isBBoxEnclosing(x0, y0, x1, y1)) {
        results.push(d);
      }
    }
    return results;
  }

  /**
   * Find all the entities fully enclosed by the bounding box.
   * @param x0 top left
   * @param y0 top left
   * @param x1 bottom right
   * @param y1 bottom right
   */
  getEntitiesWithinBBox(x0: number, y0: number, x1: number, y1: number): GraphEntity[] {
    return [
      ...this.getNodesWithinBBox(this.nodes, x0, y0, x1, y1).map(entity => ({
        type: GraphEntityType.Node,
        entity,
      })),
      ...this.getEdgesWithinBBox(this.edges, x0, y0, x1, y1).map(entity => ({
        type: GraphEntityType.Edge,
        entity,
      })),
    ];
  }

  /**
   * Get the graph entity located where the mouse is.
   * @return the entity, or nothing
   */
  abstract getEntityAtMouse(): GraphEntity | undefined;

  // ========================================
  // Rendering
  // ========================================

  /**
   * Focus on the element.
   */
  abstract focus(): void;

  /**
   * Focus the selected entity (aka focus on the related sidebar for the selection).
   */
  abstract focusEditorPanel(): void;

  /**
   * Get the current transform object that is based on the current
   * zoom and pan, which can be used to convert between viewport space and
   * graph space.
   */
  abstract get transform();

  /**
   * Request the graph be re-rendered in the very near future.
   */
  requestRender() {
    this.renderingRequested = true;
  }

  /**
   * Re-render the graph and update the mouse cursor in one shot,
   * freezing up the current thread else until the render completes. If you are just
   * display the graph for the user, never call this method directly. Instead,
   * call {@link requestRender} if a render is needed and make sure to start
   * the animation loop with {@link startAnimationLoop}.
   */
  abstract render();

  /**
   * Place the given node onto the canvas, which involves calculating the
   * real size of the object as it would appear. Use the returning object
   * to get these metrics or use the object to render the node. The
   * returned object has the style of the node baked into it.
   * @param d the node
   */
  abstract placeNode(d: UniversalGraphNode): PlacedNode;

  /**
   * Place the given edge onto the canvas, which involves calculating the
   * real size of the object as it would appear. Use the returning object
   * to get these metrics or use the object to render the node. The
   * returned object has the style of the edge baked into it.
   * @param d the edge
   */
  abstract placeEdge(d: UniversalGraphEdge): PlacedEdge;

  /**
   * Place the given entity onto the canvas, which involves calculating the
   * real size of the object as it would appear. Use the returning object
   * to get these metrics or use the object to render the entity. The
   * returned object has the style of the entity baked into it.
   * @param d the edge
   */
  placeEntity(d: GraphEntity): PlacedObject {
    if (d.type === GraphEntityType.Node) {
      return this.placeNode(d.entity as UniversalGraphNode);
    } else if (d.type === GraphEntityType.Edge) {
      return this.placeEdge(d.entity as UniversalGraphEdge);
    } else {
      throw new Error('unknown type: ' + d.type);
    }
  }

  // ========================================
  // View
  // ========================================

  /**
   * Zoom the graph to fit.
   * @param duration the duration of the animation in ms
   * @param padding padding in graph scale to add to the graph
   */
  abstract zoomToFit(duration: number, padding?);

  // ========================================
  // Selections
  // ========================================

  /**
   * Return if any one of the given items has been selected.
   * @param entities a list of entities to check
   */
  isAnySelected(...entities: UniversalGraphEntity[]) {
    const selected = this.selection.getEntitySet();
    if (!selected.size) {
      return false;
    }
    for (const d of entities) {
      if (selected.has(d)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Return if any one of the given items has been highlighted.
   * @param entities a list of entities to check
   */
  isAnyHighlighted(...entities: UniversalGraphEntity[]) {
    const highlighted = this.highlighting.getEntitySet();
    if (!highlighted.size) {
      return false;
    }
    for (const d of entities) {
      if (highlighted.has(d)) {
        return true;
      }
    }
    return false;
  }

  // ========================================
  // Events
  // ========================================

  /**
   * Called when webcola (used for layout) has ticked.
   */
  private colaTicked(): void {
    // TODO: Turn off caching temporarily instead or do something else
    this.invalidateAll();
    this.requestRender();
  }

  /**
   * Called when webcola (used for layout) has stopped. Cola will stop after finishing
   * performing the layout.
   */
  private colaEnded(): void {
    this.automaticLayoutEnabled = false;
  }

  // ========================================
  // History
  // ========================================

  /**
   * Check whether there is anything to undo.
   */
  canUndo() {
    return this.nextHistoryIndex > 0;
  }

  /**
   * Check whether there is anything to redo.
   */
  canRedo() {
    return this.nextHistoryIndex < this.history.length;
  }

  /**
   * Perform an undo, if there is anything to undo.
   * @return the action that was undone, if any
   */
  undo(): GraphAction | undefined {
    // Check to see if there is anything to undo
    if (this.canUndo()) {
      this.nextHistoryIndex--;
      const action = this.history[this.nextHistoryIndex];
      action.rollback(this);
      this.requestRender();
      this.historyChanges$.next();
      return action;
    } else {
      return null;
    }
  }

  /**
   * Perform a redo, if there is anything to redo.
   * @return the action that was redone, if any
   */
  redo(): GraphAction | undefined {
    // Check to see if there is anything to redo
    if (this.canRedo()) {
      const action = this.history[this.nextHistoryIndex];
      action.apply(this);
      this.nextHistoryIndex++;
      this.requestRender();
      this.historyChanges$.next();
      return action;
    } else {
      return null;
    }
  }

  /**
   * Execute an action and store the action to the history stack, while also resetting the
   * history pointer.
   * @param actions the actions to execute (could be an empty array)
   */
  execute(...actions: GraphAction[]): void {
    const length = actions.length;
    try {
      for (const action of actions) {
        // We have unsaved changes, drop all changes after this one
        this.history = this.history.slice(0, this.nextHistoryIndex);
        this.history.push(action);
        this.nextHistoryIndex++;

        // Apply the change
        action.apply(this);
      }
    } finally {
      if (length) {
        this.historyChanges$.next();
        this.requestRender();
      }
    }
  }

  // ========================================
  // Layout
  // ========================================

  /**
   * Apply a graph layout algorithm to the nodes.
   */
  startGraphLayout() {
    this.automaticLayoutEnabled = true;

    const nodePositionOverrideMap = this.nodePositionOverrideMap;

    const layoutNodes: GraphLayoutNode[] = this.nodes.map((d, i) => new class implements GraphLayoutNode {
      index: number = i;
      reference: UniversalGraphNode = d;
      vx = 0;
      vy = 0;

      get x() {
        return d.data.x;
      }

      set x(x) {
        d.data.x = x;
      }

      get y() {
        return d.data.y;
      }

      set y(y) {
        d.data.y = y;
      }

      get fixed() {
        return nodePositionOverrideMap.has(this.reference) ? 1 : 0;
      }

      get px() {
        const position = nodePositionOverrideMap.get(this.reference);
        if (position) {
          return position[0];
        } else {
          return null;
        }
      }

      get py() {
        const position = nodePositionOverrideMap.get(this.reference);
        if (position) {
          return position[1];
        } else {
          return null;
        }
      }
    }());

    const layoutNodeHashMap: Map<string, GraphLayoutNode> = layoutNodes.reduce(
      (map, d) => {
        map.set(d.reference.hash, d);
        return map;
      }, new Map());

    const layoutLinks: GraphLayoutLink[] = this.edges.map(d => {
      const source = layoutNodeHashMap.get(this.expectNodeByHash(d.from).hash);
      if (!source) {
        throw new Error('state error - source did not link up');
      }
      const target = layoutNodeHashMap.get(this.expectNodeByHash(d.to).hash);
      if (!target) {
        throw new Error('state error - source did not link up');
      }
      return {
        reference: d,
        source,
        target,
      };
    });

    // TODO: Remove test groups
    const layoutGroups: GraphLayoutGroup[] = [
      {
        name: 'Bands',
        color: '#740CAA',
        leaves: [],
        // groups: [],
        padding: 10,
      },
      {
        name: 'Things',
        color: '#0CAA70',
        leaves: [],
        // groups: [],
        padding: 10,
      },
    ];

    for (const node of layoutNodes) {
      const n = Math.floor(Math.random() * (layoutGroups.length + 2));
      if (n < layoutGroups.length) {
        layoutGroups[n].leaves.push(node);
      }
    }

    this.layoutGroups = layoutGroups;

    this.cola
      .nodes(layoutNodes)
      .links(layoutLinks)
      .groups(layoutGroups)
      .symmetricDiffLinkLengths(50)
      .handleDisconnected(false)
      .size([this.width, this.height])
      .start(10);
  }

  /**
   * Stop automatic re-arranging of nodes.
   */
  stopGraphLayout() {
    this.cola.stop();
    this.automaticLayoutEnabled = false;
  }
}

/**
 * Represents the object mirroring a {@link UniversalGraphNode} that is
 * passed to the layout algorithm.
 */
interface GraphLayoutNode extends InputNode {
  /**
   * A link to the original node that this object is mirroring.
   */
  reference: UniversalGraphNode;
  index: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

/**
 * Represents the object mirroring a {@link UniversalGraphEdge} that is
 * passed to the layout algorithm.
 */
interface GraphLayoutLink extends Link<GraphLayoutNode> {
  /**
   * A link to the original edge that this object is mirroring.
   */
  reference: UniversalGraphEdge;
  source: GraphLayoutNode;
  target: GraphLayoutNode;
  index?: number;
}

/**
 * Represents a grouping of nodes passed to the layout algorithm.
 */
interface GraphLayoutGroup extends Group {
  name: string;
  color: string;
  leaves?: GraphLayoutNode[];
}

enum referenceCheckingMode {
  nodeAdded = 1,
  nodeDeleted = -1,
}
