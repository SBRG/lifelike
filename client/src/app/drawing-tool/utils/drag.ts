import * as d3 from 'd3';

import { DragImage } from 'app/shared/utils/drag';
import { PlacedNode } from 'app/graph-viewer/styles/styles';
import { KnowledgeMapStyle } from 'app/graph-viewer/styles/knowledge-map-style';

import { UniversalGraphNode } from '../services/interfaces';

const style = new KnowledgeMapStyle(null);

export function createNodeDragImage(d: UniversalGraphNode): DragImage {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  const placedNode: PlacedNode = style.placeNode({
    ...d,
    data: {
      ...d.data,
      x: 0,
      y: 0,
    }
  }, ctx, {
    highlighted: false,
    selected: false,
  });
  const bbox = placedNode.getBoundingBox();
  const width = bbox.maxX - bbox.minX;
  const height = bbox.maxY - bbox.minY;
  canvas.width = width + 20; // Make extra space just in case
  canvas.height = height + 20;
  ctx.translate(width / 2 + 1, height / 2 + 1);
  placedNode.draw(d3.zoomIdentity);

  return new DragImage(canvas, width / 2, height / 2);
}
