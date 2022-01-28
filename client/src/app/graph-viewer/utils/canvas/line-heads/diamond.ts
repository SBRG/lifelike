import { ShapeTerminatorOptions } from './line-heads';
import { CustomHead } from './custom';

/**
 * Draws a diamond head.
 */
export class DiamondHead extends CustomHead {
  constructor(width: number,
              length: number,
              options: {} & ShapeTerminatorOptions = {}) {
    super([
      0, 0,
      -length / 2, -width / 2,
      -length, 0,
      -length / 2, width / 2,
      0, 0,
    ], [
      -length, 0
    ], options);
  }
}
