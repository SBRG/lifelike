import { Injectable } from '@angular/core';

import { max, min, sum } from 'd3-array';
import { first, last } from 'lodash-es';

import { TruncatePipe } from 'app/shared/pipes';
import { SankeyNode, SankeyData } from 'app/shared-sankey/interfaces';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';

import { DirectedTraversal } from './directed-traversal';
import { SankeyLayoutService } from '../components/sankey/sankey-layout.service';
import { normalizeGenerator, symmetricDifference } from '../components/sankey/utils';
import { SankeyControllerService } from './sankey-controller.service';

const groupByTraceGroupWithAccumulation = () => {
  const traceGroupOrder = new Set();
  return links => {
    links.forEach(({_trace}) => {
      traceGroupOrder.add(_trace._group);
    });
    const groups = [...traceGroupOrder];
    return links.sort((a, b) =>
      (groups.indexOf(a._trace._group) - groups.indexOf(b._trace._group))
    );
  };
};

// https://sbrgsoftware.atlassian.net/browse/LL-3732
const DEFAULT_FONT_SIZE = 12 * 1.60;

@Injectable()
// @ts-ignore
export class CustomisedSankeyLayoutService extends SankeyLayoutService {
  constructor(
    readonly truncatePipe: TruncatePipe,
    readonly sankeyController: SankeyControllerService,
    readonly warningController: WarningControllerService
  ) {
    super(truncatePipe);
  }

  get linkPath() {
    const {
      calculateLinkPathParams,
      composeLinkPath,
      sankeyController:
        {
          state:
            {
              normalizeLinks
            }
        }
    } = this;
    return link => {
      link._calculated_params = calculateLinkPathParams(link, normalizeLinks);
      return composeLinkPath(link._calculated_params);
    };
  }

  get nodeLabelShort() {
    const {
      sankeyController:
        {
          state:
            {
              labelEllipsis: {
                value,
                enabled
              }
            }
        },
      nodeLabel,
      truncatePipe: {transform}
    } = this;
    if (enabled) {
      return (d, i?, n?) => transform(nodeLabel(d, i, n), value);
    } else {
      return (d, i?, n?) => nodeLabel(d, i, n);
    }
  }

  get nodeLabelShouldBeShorted() {
    const {
      sankeyController:
        {
          state:
            {
              labelEllipsis: {
                value,
                enabled
              }
            }
        },
      nodeLabel
    } = this;
    if (enabled) {
      return (d, i?, n?) => nodeLabel(d, i, n).length > value;
    } else {
      return () => false;
    }
  }

  get nodeColor() {
    return ({_sourceLinks, _targetLinks, _color}: SankeyNode) => {
      // check if any trace is finishing or starting here
      const difference = symmetricDifference(_sourceLinks, _targetLinks, link => link._trace);
      // if it is only one then color node
      if (difference.size === 1) {
        return difference.values().next().value._trace._color;
      } else {
        return _color;
      }
    };
  }

  get fontSize() {
    const {
      sankeyController:
        {
          state:
            {
              fontSizeScale
            }
        }
    } = this;
    // noinspection JSUnusedLocalSymbols
    return (d?, i?, n?) => DEFAULT_FONT_SIZE * fontSizeScale;
  }


  normalizeLinks = false;

  columns: SankeyNode[][] = [];
  columnsWithLinkPlaceholders: SankeyNode[][] = [];

  ky; // y scaling factor (_value * ky = height)

  calculateLinkPathParams(link, normalize = true) {
    const {_source, _target, _multiple_values} = link;
    let {_value: linkValue} = link;
    linkValue = linkValue || 1e-4;
    const sourceX = _source._x1;
    const targetX = _target._x0;
    const {_sourceLinks} = _source;
    const {_targetLinks} = _target;
    const sourceIndex = _sourceLinks.indexOf(link);
    const targetIndex = _targetLinks.indexOf(link);
    const columns = Math.abs(_target._layer - _source._layer);
    const linkWidth = Math.abs(targetX - sourceX);
    const bezierOffset = (link._circular ? linkWidth / columns : linkWidth) / 2;
    const sourceBezierX = sourceX + bezierOffset;
    const targetBezierX = targetX - bezierOffset;
    let sourceY0;
    let sourceY1;
    let targetY0;
    let targetY1;
    let sourceY = 0;
    let targetY = 0;

    for (let i = 0; i < sourceIndex; i++) {
      const nestedLink = _sourceLinks[i];
      sourceY += nestedLink._multiple_values?.[0] ?? nestedLink._value;
    }
    for (let i = 0; i < targetIndex; i++) {
      const nestedLink = _targetLinks[i];
      targetY += nestedLink._multiple_values?.[1] ?? nestedLink._value;
    }

    if (normalize) {
      let sourceValues;
      let targetValues;
      if (_multiple_values) {
        sourceValues = _sourceLinks.map(l => l._multiple_values?.[0] ?? l._value);
        targetValues = _targetLinks.map(l => l._multiple_values?.[1] ?? l._value);
      } else {
        sourceValues = _sourceLinks.map(({_value}) => _value);
        targetValues = _targetLinks.map(({_value}) => _value);
      }
      const sourceNormalizer = _sourceLinks._normalizer ?? (_sourceLinks._normalizer = normalizeGenerator(sourceValues));
      const targetNormalizer = _targetLinks._normalizer ?? (_targetLinks._normalizer = normalizeGenerator(targetValues));
      const sourceHeight = _source._y1 - _source._y0;
      const targetHeight = _target._y1 - _target._y0;
      // tslint:disable-next-line:no-bitwise
      sourceY0 = (sourceNormalizer.normalize(sourceY) * sourceHeight) + _source._y0;
      // tslint:disable-next-line:no-bitwise
      targetY0 = (targetNormalizer.normalize(targetY) * targetHeight) + _target._y0;
      if (_multiple_values) {
        // tslint:disable-next-line:no-bitwise
        sourceY1 = (sourceNormalizer.normalize(_multiple_values[0]) * sourceHeight) + sourceY0;
        // tslint:disable-next-line:no-bitwise
        targetY1 = (targetNormalizer.normalize(_multiple_values[1]) * targetHeight) + targetY0;
      } else {
        // tslint:disable-next-line:no-bitwise
        sourceY1 = (sourceNormalizer.normalize(linkValue) * sourceHeight) + sourceY0;
        // tslint:disable-next-line:no-bitwise
        targetY1 = (targetNormalizer.normalize(linkValue) * targetHeight) + targetY0;
      }
    } else {
      let {_width} = link;
      _width = _width || 1e-4;
      const valueScaler = _width / linkValue;

      // tslint:disable-next-line:no-bitwise
      sourceY0 = sourceY * valueScaler + _source._y0;
      // tslint:disable-next-line:no-bitwise
      targetY0 = targetY * valueScaler + _target._y0;
      if (_multiple_values) {
        // tslint:disable-next-line:no-bitwise
        sourceY1 = _multiple_values[0] * valueScaler + sourceY0;
        // tslint:disable-next-line:no-bitwise
        targetY1 = _multiple_values[1] * valueScaler + targetY0;
      } else {
        // tslint:disable-next-line:no-bitwise
        sourceY1 = linkValue * valueScaler + sourceY0;
        // tslint:disable-next-line:no-bitwise
        targetY1 = linkValue * valueScaler + targetY0;
      }
    }
    return {
      sourceX,
      sourceY0,
      sourceY1,
      targetX,
      targetY0,
      targetY1,
      sourceBezierX,
      targetBezierX
    };
  }

  /**
   * Compose SVG path based on set of intermediate points
   */
  composeLinkPath({
                    sourceX,
                    sourceY0,
                    sourceY1,
                    targetX,
                    targetY0,
                    targetY1,
                    sourceBezierX,
                    targetBezierX
                  }) {
    return (
      `M${sourceX} ${sourceY0}` +
      `C${sourceBezierX} ${sourceY0},${targetBezierX} ${targetY0},${targetX} ${targetY0}` +
      `L${targetX} ${targetY1}` +
      `C${targetBezierX} ${targetY1},${sourceBezierX} ${sourceY1},${sourceX} ${sourceY1}` +
      `Z`
    );
  }

  /**
   * Adjust Y scale factor based on columns and min/max node height
   */
  getYScaleFactor(nodes) {
    const {
      y1, y0, py, dx, sankeyController:
        {
          state:
            {
              nodeHeight
            }
        }, value, columnsWithLinkPlaceholders: columns
    } = this;
    // normal calculation based on tallest column
    const ky = min(columns, c => (y1 - y0 - (c.length - 1) * py) / sum(c, value));
    let scale = 1;
    if (nodeHeight.max.enabled) {
      const maxCurrentHeight = max(nodes, value) * ky;
      if (nodeHeight.max.ratio) {
        const maxScaling = dx * nodeHeight.max.ratio / maxCurrentHeight;
        if (maxScaling < 1) {
          scale *= maxScaling;
        }
      }
    }
    return ky * scale;
  }

  linkSort = (a, b) => (
    // sort by order given in tree traversal
    (a._source._order - b._source._order) ||
    (a._target._order - b._target._order) ||
    (a._order - b._order)
  )

  /**
   * Iterate over nodes and recursively reiterate on the ones they are connecting to.
   * @param nodes - set of nodes to start iteration with
   * @param nextNodeProperty - property of link pointing to next node (_source, _target)
   * @param nextLinksProperty - property of node pointing to next links (_sourceLinks, _targetLinks)
   */
  getPropagatingNodeIterator = function*(nodes, nextNodeProperty, nextLinksProperty): Generator<[SankeyNode, number]> {
    const n = nodes.length;
    let current = new Set<SankeyNode>(nodes);
    let next = new Set<SankeyNode>();
    let x = 0;
    while (current.size) {
      for (const node of current) {
        yield [node, x];
        for (const link of node[nextLinksProperty]) {
          if (!link._circular) {
            next.add(link[nextNodeProperty] as SankeyNode);
          }
        }
      }
      if (++x > n) {
        throw new Error('Unaddressed circular link');
      }
      current = next;
      next = new Set();
    }
  };


  /**
   * Same as parent method just ignoring circular links
   */
  computeNodeHeights({nodes}: SankeyData) {
    const {
      ky,
      sankeyController:
        {
          state:
            {
              nodeHeight
            }
        }, value
    } = this;
    for (const node of nodes) {
      if (nodeHeight.min.enabled && nodeHeight.min.value) {
        node._height = Math.max(value(node) * ky, nodeHeight.min.value);
      } else {
        node._height = value(node) * ky;
      }
    }
  }

  layoutNodesWithinColumns(columns) {
    const {ky} = this;

    // noinspection JSUnusedLocalSymbols
    const [[_marginLeft, marginTop]] = this.extent;
    // noinspection JSUnusedLocalSymbols
    const [_width, height] = this.size;

    columns.forEach(nodes => {
      const {length} = nodes;
      const nodesHeight = sum(nodes, ({_height}) => _height);
      // do we want space above and below nodes or should it fill column till the edges?
      const additionalSpacers = length === 1 || ((nodesHeight / height) < 0.75);
      const freeSpace = height - nodesHeight;
      const spacerSize = freeSpace / (additionalSpacers ? length + 1 : length - 1);
      let y = additionalSpacers ? spacerSize + marginTop : marginTop;
      // nodes are placed in order from tree traversal
      nodes.sort((a, b) => a._order - b._order).forEach(node => {
        const nodeHeight = node._height;
        node._y0 = y;
        node._y1 = y + nodeHeight;
        y += nodeHeight + spacerSize;

        // apply the y scale on links
        for (const link of node._sourceLinks) {
          link._width = link._value * ky;
        }
      });
      for (const {_sourceLinks, _targetLinks} of nodes) {
        _sourceLinks.sort(this.linkSort);
        _targetLinks.sort(this.linkSort);
      }
      // todo: replace with
      // this.reorderLinks(nodes);
    });
  }

  /**
   * Similar to parent method however we are not having graph relaxation
   * node order is calculated by tree structure and this decision is final
   * It calculate nodes position by traversing it from side with less nodes as a tree
   * iteratively figuring order of the nodes.
   */
  computeNodeBreadths(graph) {
    const {columns} = this;

    // decide on direction
    const dt = new DirectedTraversal([first(columns), last(columns)]);
    // order next related nodes in order this group first appeared
    const sortByTrace: (links) => any = groupByTraceGroupWithAccumulation();
    const visited = new Set();
    let order = 0;
    const traceOrder = new Set();
    const relayoutLinks = linksToTraverse =>
      linksToTraverse.forEach(l => {
        relayoutNodes([dt.nextNode(l)]);
        traceOrder.add(l._trace);
      });
    const relayoutNodes = nodesToTraverse =>
      nodesToTraverse.forEach(node => {
        if (visited.has(node)) {
          return;
        }
        visited.add(node);
        node._order = order++;
        const links = sortByTrace(dt.nextLinks(node));
        relayoutLinks(links);
      });
    // traverse tree of connections
    relayoutNodes(dt.startNodes);

    const traces = [...traceOrder];
    const groups = [...traces.map(({group}) => group)];

    const tracesLength = traces.length;
    graph.links.forEach(link => {
      link._order = sum([
        // save order by group
        groups.indexOf(link._trace._group),
        // top up with fraction to order by trace
        traces.indexOf(link._trace) / tracesLength
      ]);
    });

    this.layoutNodesWithinColumns(columns);
  }

  /**
   * Helper so we can create columns copy with minimum overhead
   */
  getColumnsCopy() {
    return this.columns.map(c => [...c]);
  }

  /**
   * If link spawns on multiple columns (both normal and circular) on each intermediate
   * column place placeholder node with height of this link.
   * For best results this method places only one node with summed for all links going from the
   * same source to same target node.
   * This approach reduces overlays in more complex graphs
   */
  createVirtualNodes(graph) {
    this.columnsWithLinkPlaceholders = this.getColumnsCopy();
    // create graph backup
    graph._nodes = graph.nodes;
    // and start to operate on substitutes
    graph.nodes = [...graph.nodes];
    const _virtualPaths = new Map();

    for (const link of graph.links) {
      const totalToCreate = Math.abs(link._target._layer - link._source._layer);

      // if the link spans more than 1 column, then replace it with virtual nodes and links
      if (totalToCreate > 1) {
        const startNode = link._circular ? link._target : link._source;

        const id = link._source.id + ' ' + link._target.id;
        const virtualPath = _virtualPaths.get(id) ?? [];
        _virtualPaths.set(id, virtualPath);

        let newNode;
        for (let n = 1; n < totalToCreate; n++) {
          newNode = virtualPath[n];
          if (!newNode) {
            newNode = {
              _value: 0,
              _layer: startNode._layer + n
            } as SankeyNode;
            virtualPath.push(newNode);
            this.columnsWithLinkPlaceholders[newNode._layer].push(newNode);
          }
          newNode._value += link._value;
        }
      }
    }
  }

  /**
   * Once layout has been calculated we can safely delete placeholder nodes
   */
  cleanVirtualNodes(graph) {
    graph.nodes = graph._nodes;
  }

  // @ts-ignore
  computeNodeLayers(graph) {
    this.columns = super.computeNodeLayers(graph);
  }

  setLayoutParams(graph) {
    const {dy, y1, y0} = this;
    this.py = Math.min(dy, (y1 - y0) / (max(this.columnsWithLinkPlaceholders, c => c.length) - 1));
    this.ky = this.getYScaleFactor(graph.nodes);
  }

  /**
   * Calculate layout and address possible circular links
   */
  calcLayout(graph) {
    // Associate the nodes with their respective links, and vice versa
    this.computeNodeLinks(graph);
    // Determine which links result in a circular path in the graph
    this.identifyCircles(graph);
    // Calculate the nodes' values, based on the values of the incoming and outgoing links
    this.computeNodeValues(graph);
    // Calculate the nodes' depth based on the incoming and outgoing links
    //     Sets the nodes':
    //     - depth:  the depth in the graph
    //     - column: the depth (0, 1, 2, etc), as is relates to visual position from left to right
    //     - x0, x1: the x coordinates, as is relates to visual position from left to right
    this.computeNodeDepths(graph);
    this.computeNodeReversedDepths(graph);
    this.computeNodeLayers(graph);
    this.createVirtualNodes(graph);
    this.setLayoutParams(graph);
    this.computeNodeHeights(graph);
    // Calculate the nodes' and links' vertical position within their respective column
    //     Also readjusts sankeyCircular size if circular links are needed, and node x's
    this.computeNodeBreadths(graph);
    SankeyLayoutService.computeLinkBreadths(graph);
    this.cleanVirtualNodes(graph);
    return graph;
  }
}
