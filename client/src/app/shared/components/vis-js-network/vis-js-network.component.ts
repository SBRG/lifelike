import { AfterViewInit, Component, Input, ContentChild, Output, EventEmitter } from '@angular/core';


import { isNil } from 'lodash-es';
import { BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { DataSet } from 'vis-data/dist/umd';
import { Color, Edge, Network, Node, Options } from 'vis-network/dist/vis-network';

import { GraphData, VisNetworkDataSet } from 'app/interfaces/vis-js.interface';
import { isNodeMatching } from 'app/sankey-viewer/components/search-match';
import { toTitleCase, uuidv4 } from 'app/shared/utils';

import { networkSolvers, networkEdgeSmoothers } from './vis-js-network.constants';
import { FindOptions, compileFind, tokenizeQuery } from '../../utils/find';


@Component({
  selector: 'app-vis-js-network',
  templateUrl: './vis-js-network.component.html',
  styleUrls: ['./vis-js-network.component.scss']
})
export class VisJsNetworkComponent implements AfterViewInit {
  @Input() set config(config: Options) {
    this.networkConfig = config;

    if (!isNil(config.physics)) {
      this.currentSolver = config.physics.solver || networkSolvers.BARNES_HUT;

      if (!isNil(config.physics[this.currentSolver])) {
        this.currentCentralGravity = config.physics[this.currentSolver].centralGravity;
      } else {
        this.currentCentralGravity = 0.1;
      }

      this.physicsEnabled = config.physics.enabled || true;
    } else {
      this.setDefaultPhysics();
      this.physicsEnabled = true;
    }

    // `config.edges.smooth` can be of either type boolean or type object. Here we're just checking that it is an object before trying to
    // access its properties.
    if (!isNil(config.edges.smooth) && typeof config.edges.smooth === 'object') {
      this.currentSmooth = config.edges.smooth.type || networkEdgeSmoothers.DYNAMIC;
    }

    if (!isNil(this.networkGraph)) {
      this.createNetwork();
    }
  }

  @Input() set data(data: GraphData) {
    this.networkData.nodes.update(data.nodes);
    this.networkData.edges.update(data.edges);
    if (!isNil(this.networkGraph)) {
      this.setNetworkData();
    }
  }

  @Input() legend: Map<string, string[]>;

  @ContentChild('selection', {static: true}) selection;

  SCALE_MODIFIER = 0.11;

  networkConfig: Options;
  networkData: VisNetworkDataSet;
  networkGraph: Network;
  networkContainerId: string;

  stabilized: boolean;
  physicsEnabled: boolean;

  solverMap: Map<string, string>;
  currentSolver: string;

  smoothMap: Map<string, string>;
  currentSmooth: string;

  currentCentralGravity: number;

  currentSearchIndex: number;
  searchResults: Array<Node>;
  searchQuery: string;

  cursorStyle: string;

  selected;

  @Output() selectionChange = new EventEmitter();
  @Output() nodeHover = new EventEmitter();
  @Output() nodeBlur = new EventEmitter();

  constructor() {
    this.selected = new BehaviorSubject({nodes: [], edges: []}).pipe(
      map(({nodes, edges}) => ({
        nodes: this.networkData.nodes.get(nodes),
        edges: this.networkData.edges.get(edges)
      })),
      tap(d => this.selectionChange.emit(d))
    );

    this.legend = new Map<string, string[]>();

    this.networkConfig = {};
    this.networkData = {
      nodes: new DataSet<Node, 'id'>(),
      edges: new DataSet<Edge, 'id'>(),
    };
    this.networkContainerId = uuidv4();

    this.stabilized = false;
    this.physicsEnabled = true;

    this.setupSolverMap();
    this.setupSmoothMap();

    this.setDefaultPhysics();
    this.currentSmooth = networkEdgeSmoothers.DYNAMIC;

    this.currentSearchIndex = 0;
    this.searchResults = [];
    this.searchQuery = '';

    this.cursorStyle = 'default';
  }

  ngAfterViewInit() {
    this.createNetwork();
  }

  setDefaultPhysics() {
    this.currentSolver = networkSolvers.BARNES_HUT;
    this.currentCentralGravity = 0.1;
  }

  /**
   * Defines solverMap Map object, where the keys are Vis.js accepted solver types, and the values are UI appropriate strings.
   */
  setupSolverMap() {
    this.solverMap = new Map<string, string>();

    for (const solver in networkSolvers) {
      // This if suppresses the “for ... in ... statements must be filtered with an if statement”
      if (networkSolvers[solver]) {
        this.solverMap.set(networkSolvers[solver], toTitleCase(solver.split('_').join(' ')));
      }
    }
  }

  /**
   * Defines smoothMap Map object, where the keys are Vis.js accepted edge smooth types, and the values are UI appropriate strings.
   */
  setupSmoothMap() {
    this.smoothMap = new Map<string, string>();

    for (const solver in networkEdgeSmoothers) {
      // This if suppresses the “for ... in ... statements must be filtered with an if statement”
      if (networkEdgeSmoothers[solver]) {
        this.smoothMap.set(networkEdgeSmoothers[solver], toTitleCase(solver.split('_').join(' ')));
      }
    }
  }

  /**
   * Resets the network data. Be careful using this method! It will cause the network to be re-drawn and stabilized, and is therefore
   * rather slow. If there isn't a need to reset the entire network, it is better to use the DataSet update method for nodes and edges.
   */
  setNetworkData() {
    this.networkGraph.setData(this.networkData);
  }

  /**
   * Creates the Vis.js network. Also sets up event callbacks. Should be called after the view is initialized, otherwise the network
   * container may not exist.
   */
  createNetwork() {
    const container = document.getElementById(this.networkContainerId);

    this.stabilized = false;
    this.networkGraph = new Network(
      container,
      this.networkData,
      this.networkConfig
    );
    this.setupEventBinds();
    this.networkGraph.stabilize(500);
  }

  fitToNetwork() {
    this.networkGraph.fit();
  }

  zoomIn() {
    this.networkGraph.moveTo({
      scale: this.networkGraph.getScale() + this.SCALE_MODIFIER,
    });
  }

  zoomOut() {
    this.networkGraph.moveTo({
      scale: this.networkGraph.getScale() - this.SCALE_MODIFIER,
    });
  }

  togglePhysics() {
    this.physicsEnabled = !this.physicsEnabled;
    this.networkConfig = {
      ...this.networkConfig,
      physics: {
        enabled: this.physicsEnabled,
      }
    };

    this.networkGraph.setOptions({
      ...this.networkConfig,
    });
  }

  /**
   * Updates the Vis.js network to use the provided layout solver. Also updates the currently selected solver, which is reflected in the UI.
   * @param layoutType string representing the newly selected layout solver, expected to be one of networkSolvers
   */
  updateNetworkLayout(layoutType: string) {
    this.currentSolver = layoutType;
    this.physicsEnabled = true;
    this.networkConfig = {
      ...this.networkConfig,
      physics: {
        enabled: this.physicsEnabled,
        solver: layoutType,
      }
    };
    this.createNetwork();
  }

  /**
   * Updates the Vis.js network to use the provided edge smoother. Also updates the currently selected smoother, which is reflected in the
   * UI.
   * @param smoothType string representing the newly selected layout smoother, expected to be one of networkEdgeSmoothers
   */
  updateNetworkEdgeSmooth(smoothType: string) {
    this.currentSmooth = smoothType;

    let smooth = {
      enabled: true,
      type: smoothType,
      roundness: 0.5,
    };
    if (typeof this.networkConfig.edges.smooth === 'object') {
      smooth = {
        ...this.networkConfig.edges.smooth,
        type: smoothType,
      };
    }

    this.networkConfig = {
      ...this.networkConfig,
      edges: {
        smooth
      }
    };

    this.networkGraph.setOptions({
      ...this.networkConfig,
    });
  }

  updateNetworkCentralGravity(centralGravity: string) {
    this.currentCentralGravity = parseFloat(centralGravity);
    this.updateSolverProps();
  }

  updateSolverProps() {
    const solver = {
      centralGravity: this.currentCentralGravity,
    };

    if (!isNil(this.networkConfig.physics[this.currentSolver])) {
      this.networkConfig.physics[this.currentSolver] = {
        ...this.networkConfig.physics[this.currentSolver],
        ...solver
      };
    } else {
      this.networkConfig.physics[this.currentSolver] = solver;
    }

    this.networkGraph.setOptions({
      ...this.networkConfig,
    });
  }

  /**
   * Finds all nodes which contain the given substring in their label and returns copies of these nodes. Returning copies ensures we do not
   * accidentally mutate the data.
   * @param terms the terms
   * @param options addiitonal find options
   */
  findMatching(terms: string[], options: FindOptions = {}) {
    const matcher = compileFind(terms, options);
    const matches = [];

    const nodes = this.networkData.nodes.get();

    for (const node of nodes) {
      if (isNodeMatching(matcher, node)) {
        matches.push(node);
      }
    }

    return matches;
  }

  searchQueryChanged() {
    // Need to revert the previous search results back to their original values
    if (this.searchResults.length > 0) {
      this.networkData.nodes.update(this.searchResults.map(({id}) => this.unhighlightNode(id)));
    }

    if (this.searchQuery !== '') {
      this.searchResults = this.findMatching(
        tokenizeQuery(this.searchQuery, {
          singleTerm: true,
        }), {
          wholeWord: false,
        });

      this.currentSearchIndex = 0;
      this.networkData.nodes.update(this.searchResults.map(({id}) => this.highlightNode(id)));
      this.focusNode(this.searchResults[this.currentSearchIndex].id);
    } else {
      this.searchResults = [];
    }
  }

  findNext() {
    if (this.searchResults.length > 0) {
      // If we're about to go beyond the search result total, wrap back to the beginning
      if (this.currentSearchIndex + 1 === this.searchResults.length) {
        this.currentSearchIndex = 0;
      } else {
        this.currentSearchIndex += 1;
      }
      this.focusNode(this.searchResults[this.currentSearchIndex].id);
    }
  }

  findPrevious() {
    if (this.searchResults.length > 0) {
      // If we're about to reach negative indeces, then wrap to the end
      if (this.currentSearchIndex - 1 === -1) {
        this.currentSearchIndex = this.searchResults.length - 1;
      } else {
        this.currentSearchIndex -= 1;
      }
      this.focusNode(this.searchResults[this.currentSearchIndex].id);
    }
  }

  focusNode(nodeId: number | string) {
    this.networkGraph.focus(nodeId);
    // Zoom in on the focused node, otherwise it might be hard to find
    this.networkGraph.moveTo({
      scale: 0.99,
    });
  }

  highlightNode(nodeId: number | string) {
    // do not update to initial position
    const {x, y, ...nodeToHighlight} = this.networkData.nodes.get(nodeId);
    const nodeColor = (nodeToHighlight.color as Color);
    // @ts-ignore
    nodeToHighlight._initialBorderWidth = nodeToHighlight.borderWidth;
    // @ts-ignore
    nodeToHighlight._initialColor = nodeColor;
    nodeToHighlight.borderWidth = 2;
    nodeToHighlight.color = {
      ...nodeColor,
      border: 'red'
    } as Color;
    return nodeToHighlight;
  }

  unhighlightNode(nodeId: number | string) {
    // do not update to initial position
    // @ts-ignore
    const {x, y, _initialBorderWidth = 1, _initialColor, ...nodeToHighlight} = this.networkData.nodes.get(nodeId);
    nodeToHighlight.borderWidth = _initialBorderWidth;
    nodeToHighlight.color = _initialColor;
    return nodeToHighlight;
  }

  /**
   * Contains all of the event handling features for the network graph.
   */
  setupEventBinds() {
    const {selected, nodeHover, nodeBlur} = this;
    this.networkGraph.on('stabilizationIterationsDone', _ => {
      this.stabilized = true;
      this.networkGraph.fit();
    });
    this.networkGraph.on('dragStart', ({nodes}) => {
      this.cursorStyle = nodes.length > 0 ? 'grabbing' : 'move';
    });
    this.networkGraph.on('dragEnd', () => {
      this.cursorStyle = 'default';
    });

    this.networkGraph.on('select', ({nodes, edges}) => selected.next({nodes, edges}));
    this.networkGraph.on('deselectNode', ({nodes, edges}) => selected.next({nodes, edges}));
    this.networkGraph.on('deselectEdge', ({nodes, edges}) => selected.next({nodes, edges}));
    this.networkGraph.on('hoverNode', function({node: nodeId}) {
      const node = this.body.nodes[nodeId];
      nodeHover.emit(node.options);
      node.needsRefresh();
    });
    this.networkGraph.on('blurNode', function({node: nodeId}) {
      const node = this.body.nodes[nodeId];
      nodeBlur.emit(node.options);
      node.needsRefresh();
    });
  }
}
