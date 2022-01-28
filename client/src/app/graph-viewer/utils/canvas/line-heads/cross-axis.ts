import { ShapeTerminatorOptions } from './line-heads';
import { RectangleHead } from './rectangle';

/**
 * Draws a cross-axis line at the end of the line.
 */
export class CrossAxisLineHead extends RectangleHead {
  constructor(height: number,
              options: {} & ShapeTerminatorOptions = {}) {
    super(height * 0.25, height, options);
  }
}
