// region Licenses
// Based on:
// Copyright 2015, Mike Bostock
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification,
// are permitted provided that the following conditions are met:
//
// * Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
//
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
//
// * Neither the name of the author nor the names of contributors may be used to
//   endorse or promote products derived from this software without specific prior
//   written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
// ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// And on:
// MIT License
//
// Copyright (c) 2017 Tom Shanley
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// endregion

import { Injectable } from '@angular/core';

import findCircuits from 'elementary-circuits-directed-graph';
import { max, min, sum } from 'd3-array';

import { TruncatePipe } from 'app/shared/pipes';
import { SankeyData, SankeyNode, SankeyLink } from 'app/shared-sankey/interfaces';

import { AttributeAccessors } from './attribute-accessors';
import { justify } from './aligin';

@Injectable()
export class SankeyLayoutService extends AttributeAccessors {
  constructor(readonly truncatePipe: TruncatePipe) {
    super(truncatePipe);
  }

  get size() {
    return [this.x1 - this.x0, this.y1 - this.y0];
  }

  set size(size) {
    this.x1 = this.x0 + size[0];
    this.y1 = this.y0 + size[1];
  }

  get extent() {
    return [[this.x0, this.y0], [this.x1, this.y1]];
  }

  set extent(extent) {
    [[this.x0, this.y0], [this.x1, this.y1]] = extent;
  }

  x0;
  y0;
  x1;
  y1; // extent
  dy = 8;
  dx = 24; // nodeWidth
  py; // nodePadding

  nodeSort;
  linkSort;
  nodes: Array<SankeyNode>;
  links: Array<SankeyLink>;
  iterations = 6;


  // Some constants for circular link calculations
  baseRadius = 10;
  scale = 0.3;

  static find(nodeById, id) {
    const node = nodeById.get(id);
    if (!node) {
      // todo: use our error handler when figure out how to deal with inheritance
      throw new Error(`Node (id: ${id}) needed to render this graph has not be provided in file.`);
    }
    return node as SankeyNode;
  }

  static ascendingSourceBreadth(a, b) {
    return SankeyLayoutService.ascendingBreadth(a._source, b._source) || a._index - b._index;
  }

  static ascendingTargetBreadth(a, b) {
    return SankeyLayoutService.ascendingBreadth(a._target, b._target) || a._index - b._index;
  }

  static ascendingBreadth(a, b) {
    return a._y0 - b._y0;
  }

  static computeLinkBreadths({nodes}: SankeyData) {
    for (const node of nodes) {
      let y0 = node._y0;
      let y1 = y0;
      for (const link of node._sourceLinks) {
        link._y0 = y0 + link._width / 2;
        // noinspection JSSuspiciousNameCombination
        y0 += link._width;
      }
      for (const link of node._targetLinks) {
        link._y1 = y1 + link._width / 2;
        // noinspection JSSuspiciousNameCombination
        y1 += link._width;
      }
    }
  }

  align(n, node) {
    return justify(n, node);
  }

  update(graph) {
    SankeyLayoutService.computeLinkBreadths(graph);
  }

  /**
   * Given list of links resolve their source/target node id to actual object
   * and register this link to input/output link list in node.
   */
  registerLinks({links, nodes}) {
    const {id} = this;
    const {find} = SankeyLayoutService;

    const nodeById = new Map(nodes.map((d, i) => [id(d, i, nodes), d]));
    for (const [i, link] of links.entries()) {
      link._index = i;
      const {source, target} = link;
      let {_source, _target} = link;
      if (typeof _source !== 'object') {
        _source = link._source = typeof source !== 'object' ? find(nodeById, source) : source;
      }
      if (typeof _target !== 'object') {
        _target = link._target = typeof target !== 'object' ? find(nodeById, target) : target;
      }
      _source._sourceLinks.push(link);
      _target._targetLinks.push(link);
    }
    if (this.linkSort) {
      const relatedNodes = links.reduce(
        (o, {_source, _target}) => {
          o.add(_source);
          o.add(_target);
          return o;
        },
        new Set()
      );
      for (const {_sourceLinks, _targetLinks} of relatedNodes) {
        _sourceLinks.sort(this.linkSort);
        _targetLinks.sort(this.linkSort);
      }
    }
  }

  /**
   * Each node maintains list of its source/target links
   * this function resets these lists and repopulates them
   * based on list of links.
   */
  computeNodeLinks({nodes, links}: SankeyData) {
    for (const [i, node] of nodes.entries()) {
      node._index = i;
      node._sourceLinks = [];
      node._targetLinks = [];
    }
    this.registerLinks({links, nodes});
  }

  /**
   * Find circular links using Johnson's circuit finding algorithm.
   * This function simply preformats data cals `elementary-circuits-directed-graph`
   * library and add results to our graph object.
   */
  identifyCircles(graph: SankeyData) {
    let circularLinkID = 0;

    // Building adjacency graph
    const adjList = [];
    graph.links.forEach(link => {
      const source = (link._source as SankeyNode)._index;
      const target = (link._target as SankeyNode)._index;
      if (!adjList[source]) {
        adjList[source] = [];
      }
      if (!adjList[target]) {
        adjList[target] = [];
      }

      // Add links if not already in set
      if (adjList[source].indexOf(target) === -1) {
        adjList[source].push(target);
      }
    });

    // Find all elementary circuits
    const cycles = findCircuits(adjList);

    // Sort by circuits length
    cycles.sort((a, b) => a.length - b.length);

    const circularLinks = {};
    for (const cycle of cycles) {
      const last = cycle.slice(-2);
      if (!circularLinks[last[0]]) {
        circularLinks[last[0]] = {};
      }
      circularLinks[last[0]][last[1]] = true;
    }

    graph.links.forEach(link => {
      const target = (link._target as SankeyNode)._index;
      const source = (link._source as SankeyNode)._index;
      // If self-linking or a back-edge
      if (target === source || (circularLinks[source] && circularLinks[source][target])) {
        link._circular = true;
        link._circularLinkID = circularLinkID;
        circularLinkID = circularLinkID + 1;
      } else {
        link._circular = false;
      }
    });
  }

  get sourceValue(): (link: SankeyLink) => number {
    return ({_value, _multiple_values}) => _multiple_values?.[0] ?? _value;
  }

  get targetValue(): (link: SankeyLink) => number {
    return ({_value, _multiple_values}) => _multiple_values?.[1] ?? _value;
  }

  /**
   * Assign node value either based on _fixedValue property or as a max of
   * sum of all source links and sum of target links.
   */
  computeNodeValues({nodes}: SankeyData) {
    const {sourceValue, targetValue} = this;
    for (const node of nodes) {
      node._value = node._fixedValue ?? Math.max(sum(node._sourceLinks, sourceValue), sum(node._targetLinks, targetValue));
    }
  }

  /**
   * Calculate the nodes' depth based on the incoming and outgoing links
   * Sets the nodes':
   * - depth:  the depth in the graph
   */
  computeNodeDepths({nodes}: SankeyData) {
    for (const [node, x] of this.getPropagatingNodeIterator(nodes, '_target', '_sourceLinks')) {
      node._depth = x;
    }
  }

  computeNodeReversedDepths({nodes}: SankeyData) {
    for (const [node, x] of this.getPropagatingNodeIterator(nodes, '_source', '_targetLinks')) {
      node._reversedDepth = x;
    }
  }

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
          next.add(link[nextNodeProperty] as SankeyNode);
        }
      }
      if (++x > n) {
        throw new Error('circular link');
      }
      current = next;
      next = new Set();
    }
  };

  /**
   * Calculate into which layer node has to be placed and assign x coordinates of this layer
   * - _layer: the depth (0, 1, 2, etc), as is relates to visual position from left to right
   * - _x0, _x1: the x coordinates, as is relates to visual position from left to right
   */
  computeNodeLayers({nodes}: SankeyData): SankeyNode[][] {
    const {x1, x0, dx, align} = this;
    const x = max(nodes, d => d._depth) + 1;
    const kx = (x1 - x0 - dx) / (x - 1);
    const columns = new Array(x);
    for (const node of nodes) {
      const i = Math.max(0, Math.min(x - 1, Math.floor(align.call(null, node, x))));
      node._layer = i;
      node._x0 = x0 + i * kx;
      node._x1 = node._x0 + dx;
      if (columns[i]) {
        columns[i].push(node);
      } else {
        columns[i] = [node];
      }
    }
    if (this.nodeSort) {
      for (const column of columns) {
        column.sort(this.nodeSort);
      }
    }
    return columns;
  }

  /**
   * Calculate Y scaling factor and initialise nodes height&position.
   */
  initializeNodeBreadths(columns: SankeyNode[][]) {
    const {y1, y0, py, value} = this;

    const ky = min(columns, c => (y1 - y0 - (c.length - 1) * py) / sum(c, value));
    for (const nodes of columns) {
      let y = y0;
      for (const node of nodes) {
        node._y0 = y;
        node._y1 = y + node._value * ky;
        y = node._y1 + py;
        for (const link of node._sourceLinks) {
          link._width = link._value * ky;
        }
      }
      y = (y1 - y + py) / (nodes.length + 1);
      for (let i = 0; i < nodes.length; ++i) {
        const node = nodes[i];
        node._y0 += y * (i + 1);
        node._y1 += y * (i + 1);
      }
      this.reorderLinks(nodes);
    }
  }

  /**
   * Initialise node position both on column and Y, then try rearranging them to untangle network.
   */
  computeNodeBreadths(graph) {
    const {dy, y1, y0, iterations} = this;
    const columns = this.computeNodeLayers(graph);
    this.py = Math.min(dy, (y1 - y0) / (max(columns, c => c.length) - 1));
    this.initializeNodeBreadths(columns);
    for (let i = 0; i < iterations; ++i) {
      const alpha = Math.pow(0.99, i);
      const beta = Math.max(1 - alpha, (i + 1) / iterations);
      this.relaxRightToLeft(columns, alpha, beta);
      this.relaxLeftToRight(columns, alpha, beta);
    }
  }

  /**
   * Going from left to right try putting next linked nodes in straight lines
   * then resolve just made collisions.
   */
  relaxLeftToRight(columns, alpha, beta) {
    for (let i = 1, n = columns.length; i < n; ++i) {
      const column = columns[i];
      for (const target of column) {
        let y = 0;
        let w = 0;
        for (const {_source, _value} of target._targetLinks) {
          const v = _value * (target._layer - _source._layer);
          y += this.targetTop(_source, target) * v;
          w += v;
        }
        if (!(w > 0)) {
          continue;
        }
        const dy = (y / w - target._y0) * alpha;
        target._y0 += dy;
        target._y1 += dy;
        this.reorderNodeLinks(target);
      }
      if (this.nodeSort === undefined) {
        column.sort(SankeyLayoutService.ascendingBreadth);
      }
      this.resolveCollisions(column, beta);
    }
  }

  /**
   * Going from right to left try putting next linked nodes in straight lines
   * then resolve just made collisions.
   */
  relaxRightToLeft(columns, alpha, beta) {
    const {ascendingBreadth} = SankeyLayoutService;

    for (let n = columns.length, i = n - 2; i >= 0; --i) {
      const column = columns[i];
      for (const source of column) {
        let y = 0;
        let w = 0;
        for (const {_target, _value} of source._sourceLinks) {
          const v = _value * (_target._layer - source._layer);
          y += this.sourceTop(source, _target) * v;
          w += v;
        }
        if (!(w > 0)) {
          continue;
        }
        const dy = (y / w - source._y0) * alpha;
        source._y0 += dy;
        source._y1 += dy;
        this.reorderNodeLinks(source);
      }
      if (this.nodeSort === undefined) {
        column.sort(ascendingBreadth);
      }
      this.resolveCollisions(column, beta);
    }
  }

  /**
   * Move nodes up and down hopefully resolving collisions.
   */
  resolveCollisions(nodes: Array<SankeyNode>, alpha) {
    const {
      py, y1, y0
    } = this;
    // tslint:disable-next-line:no-bitwise
    const i = nodes.length >> 1;
    const subject = nodes[i];
    this.resolveCollisionsBottomToTop(nodes, subject._y0 - py, i - 1, alpha);
    this.resolveCollisionsTopToBottom(nodes, subject._y1 + py, i + 1, alpha);
    this.resolveCollisionsBottomToTop(nodes, y1, nodes.length - 1, alpha);
    this.resolveCollisionsTopToBottom(nodes, y0, 0, alpha);
  }

  /**
   * Rearrange nodes down.
   */
  resolveCollisionsTopToBottom(nodes, y, i, alpha) {
    const {py} = this;
    for (; i < nodes.length; ++i) {
      const node = nodes[i];
      const dy = (y - node._y0) * alpha;
      if (dy > 1e-6) {
        node._y0 += dy, node._y1 += dy;
      }
      y = node._y1 + py;
    }
  }

  /**
   * Rearrange nodes up.
   */
  resolveCollisionsBottomToTop(nodes, y, i, alpha) {
    const {py} = this;
    for (; i >= 0; --i) {
      const node = nodes[i];
      const dy = (node._y1 - y) * alpha;
      if (dy > 1e-6) {
        node._y0 -= dy, node._y1 -= dy;
      }
      y = node._y0 - py;
    }
  }

  reorderNodeLinks({_sourceLinks, _targetLinks}) {
    const {
      ascendingTargetBreadth,
      ascendingSourceBreadth
    } = SankeyLayoutService;

    for (const {_source} of _targetLinks) {
      _source._sourceLinks.sort(ascendingTargetBreadth);
    }
    for (const {_target} of _sourceLinks) {
      _target._targetLinks.sort(ascendingSourceBreadth);
    }
  }

  reorderLinks(nodes) {
    const {
      ascendingTargetBreadth,
      ascendingSourceBreadth
    } = SankeyLayoutService;

    for (const {_sourceLinks, _targetLinks} of nodes) {
      _sourceLinks.sort(ascendingTargetBreadth);
      _targetLinks.sort(ascendingSourceBreadth);
    }
  }

  /**
   * Returns the target._y0 that would produce an ideal link from source to target.
   */
  targetTop(source, target) {
    const {py} = this;
    let y = source._y0 - (source._sourceLinks.length - 1) * py / 2;
    for (const {_target: node, _width} of source._sourceLinks) {
      if (node === target) {
        break;
      }
      y += _width + py;
    }
    for (const {_source: node, _width} of target._targetLinks) {
      if (node === source) {
        break;
      }
      // noinspection JSSuspiciousNameCombination
      y -= _width;
    }
    return y;
  }

  /**
   * Returns the source._y0 that would produce an ideal link from source to target.
   */
  sourceTop(source, target) {
    const {py} = this;
    let y = target._y0 - (target._targetLinks.length - 1) * py / 2;
    for (const {_source: node, _width} of target._targetLinks) {
      if (node === source) {
        break;
      }
      y += _width + py;
    }
    for (const {_target: node, _width} of source._sourceLinks) {
      if (node === target) {
        break;
      }
      // noinspection JSSuspiciousNameCombination
      y -= _width;
    }
    return y;
  }

  rescaleNodePosition(graph, innerWidthChangeRatio) {
    const {dx, x0} = this;
    for (const node of graph.nodes) {
      node._x0 = (node._x0 - x0) * innerWidthChangeRatio + x0;
      node._x1 = node._x0 + dx;
    }
  }

  calcLayout(graph) {
    // Process the graph's nodes and links, setting their positions

    // Associate the nodes with their respective links, and vice versa
    this.computeNodeLinks(graph);
    // Determine which links result in a circular path in the graph
    // this.identifyCircles(graph);
    // Calculate the nodes' values, based on the values of the incoming and outgoing links
    this.computeNodeValues(graph);
    // Calculate the nodes' depth based on the incoming and outgoing links
    //     Sets the nodes':
    //     - depth:  the depth in the graph
    this.computeNodeDepths(graph);
    this.computeNodeReversedDepths(graph);
    // Calculate the nodes' and links' vertical position within their respective column
    //     Also readjusts sankeyCircular size if circular links are needed, and node x's
    //     - column: the depth (0, 1, 2, etc), as is relates to visual position from left to right
    //     - x0, x1: the x coordinates, as is relates to visual position from left to right
    this.computeNodeBreadths(graph);
    SankeyLayoutService.computeLinkBreadths(graph);
    return graph;
  }
}
