import intersects from 'intersects';

// TODO: Clean up / find an alternative
export function pointOnRect(x, y, minX, minY, maxX, maxY, validate) {
  if (validate && (minX < x && x < maxX) && (minY < y && y < maxY)) {
    return {x, y};
  }
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  // if (midX - x == 0) -> m == ±Inf -> minYx/maxYx == x (because value / ±Inf = ±0)
  const m = (midY - y) / (midX - x);

  if (x <= midX) { // check "left" side
    const minXy = m * (minX - x) + y;
    if (minY <= minXy && minXy <= maxY) {
      return {x: minX, y: minXy};
    }
  }

  if (x >= midX) { // check "right" side
    const maxXy = m * (maxX - x) + y;
    if (minY <= maxXy && maxXy <= maxY) {
      return {x: maxX, y: maxXy};
    }
  }

  if (y <= midY) { // check "top" side
    const minYx = (minY - y) / m + x;
    if (minX <= minYx && minYx <= maxX) {
      return {x: minYx, y: minY};
    }
  }

  if (y >= midY) { // check "bottom" side
    const maxYx = (maxY - y) / m + x;
    if (minX <= maxYx && maxYx <= maxX) {
      return {x: maxYx, y: maxY};
    }
  }

  // edge case when finding midpoint intersection: m = 0/0 = NaN
  if (x === midX && y === midY) {
    return {x, y};
  }

  // Should never happen :) If it does, please tell me!
  return {x, y};
}

// TODO: Clean up
export function getLinePointIntersectionDistance(x, y, x1, x2, y1, y2) {
  if (!intersects.pointLine(x, y, x1, y1, x2, y2)) {
    return Infinity;
  }
  const expectedSlope = (y2 - y1) / (x2 - x1);
  const slope = (y - y1) / (x - x1);
  return Math.abs(slope - expectedSlope);
}

export function distanceUnsq(x0: number, y0: number, x1: number, y1: number): number {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return dx * dx + dy * dy;
}

export function distanceSq(x0: number, y0: number, x1: number, y1: number): number {
  return Math.sqrt(distanceUnsq(x0, y0, x1, y1));
}

/**
 * Use the given line segment from [startX, startY] to [endX, endY] to
 * calculate the revolution that must be applied to the point [x, y] if
 * revolved around [endX, endY].
 * @param startX the start X
 * @param startY the start Y
 * @param endX the end X
 * @param endY the end Y
 * @param x the X to transform
 * @param y the Y to transform
 */
export function transformControlPoint(startX: number,
                                      startY: number,
                                      endX: number,
                                      endY: number,
                                      x: number,
                                      y: number): [number, number] {
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const sin = dy / len;
  const cos = dx / len;

  return [
    x * cos - y * sin + endX,
    x * sin + y * cos + endY
  ];
}

/**
 * Use the given line segment from [startX, startY] to [endX, endY] to
 * calculate the revolution that must be applied to the provided points if
 * revolved around [endX, endY].
 * @param startX the start X
 * @param startY the start Y
 * @param endX the end X
 * @param endY the end Y
 * @param points a list of points
 */
export function* transformControlPoints(startX: number,
                                        startY: number,
                                        endX: number,
                                        endY: number,
                                        points: number[]) {
  const dx = endX - startX;
  const dy = endY - startY;
  const len = Math.sqrt(dx * dx + dy * dy);
  const sin = dy / len;
  const cos = dx / len;

  for (let i = 0; i < points.length; i += 2) {
    const x = points[i] * cos - points[i + 1] * sin + endX;
    const y = points[i] * sin + points[i + 1] * cos + endY;
    yield {
      x, y, i: i / 2
    };
  }
}
