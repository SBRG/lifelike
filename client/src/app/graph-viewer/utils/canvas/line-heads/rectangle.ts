import { ShapeTerminatorOptions } from './line-heads';
import { CustomHead } from './custom';

/**
 * Draws a rectangle at the end of the line.
 */
export class RectangleHead extends CustomHead {
  lineCap: CanvasLineCap = 'butt';

  constructor(width: number,
              height: number,
              options: {} & ShapeTerminatorOptions = {}) {
    super([
      0, -height / 2,
      -width, -height / 2,
      -width, height / 2,
      0, height / 2,
      0, -height / 2,
    ], [
      -width, 0
    ], options);
  }
}
