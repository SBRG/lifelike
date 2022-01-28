import { isNil } from 'lodash-es';

import { GraphData } from 'app/interfaces/vis-js.interface';
import { annotationTypesMap } from 'app/shared/annotation-styles';

import { TraceNode, TraceData } from './interfaces';

function find(nodeById, id) {
  const node = nodeById.get(id);
  if (!node) {
    throw new Error('missing: ' + id);
  }
  return node;
}

function* generateSLayout(segmentSize, scale = 1) {
  let x = 2 * segmentSize + 1;
  let y = 0;
  let xIncrement = false;

  function* iterateX() {
    while (
      (xIncrement && x < 2 * segmentSize) ||
      (!xIncrement && x > 0)
      ) {
      x += xIncrement ? 1 : -1;
      yield {x: x * scale, y: y * scale};
    }
    xIncrement = !xIncrement;
    yield* iterateY();
  }

  function* iterateY() {
    let i = 0;
    while (i < segmentSize) {
      i++;
      y++;
      yield {x: x * scale, y: y * scale};
    }
    yield* iterateX();
  }

  yield* iterateX();
}

export const getTraceDetailsGraph = (trace: TraceData) => {
  const {edges, nodes} = trace;
  nodes.forEach(node => {
    node._fromEdges = [];
    node._toEdges = [];
  });
  const nodeById = new Map(nodes.map(d => [d.id, d]));
  for (const edge of edges) {
    const {
      from, to
    } = edge;
    if (typeof from !== 'object') {
      edge._fromObj = find(nodeById, from);
      edge._fromObj._fromEdges.push(edge);
    }
    if (typeof to !== 'object') {
      edge._toObj = find(nodeById, to);
      edge._toObj._toEdges.push(edge);
    }
  }
  const startNode = find(nodeById, trace.source);
  const endNode = find(nodeById, trace.target);

  [startNode, endNode].map(node => {
    node.borderWidth = 5;
  });

  const segmentSize = Math.ceil(nodes.length / 8);

  const sLayout = generateSLayout(segmentSize, 2500 / segmentSize);
  const traverseGraph = (node: TraceNode) => {
    if (!node._visited) {
      const nextPosition = sLayout.next().value;
      if (node._fromEdges.length <= 1 && node._toEdges.length <= 1) {
        Object.assign(node, nextPosition);
        // Object.assign(node, nextPosition, {fixed: {x: true, y: true}});
      }
      node._visited = true;
      node._toEdges.forEach(edge => {
        if (edge._fromObj !== endNode && !edge._visited) {
          edge._visited = true;
          traverseGraph(edge._fromObj);
        }
      });
      node._fromEdges.forEach(edge => {
        if (edge._toObj !== endNode && !edge._visited) {
          edge._visited = true;
          traverseGraph(edge._toObj);
        }
      });
    }
  };
  traverseGraph(startNode);

  return {
    startNode,
    endNode,
    edges,
    nodes: nodes.map(n => {
      const label = n.type || 'unknown';
      const style = annotationTypesMap.get(label.toLowerCase());
      return {
        ...n,
        color: isNil(style) ? '#000' : style.color
      };
    })
  } as GraphData;
};
