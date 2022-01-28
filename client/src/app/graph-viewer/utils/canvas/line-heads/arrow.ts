import { CustomHead } from './custom';
import { ShapeTerminatorOptions } from './line-heads';

/**
 * Draws an arrowhead.
 */
export class Arrowhead extends CustomHead {
  constructor(width: number, options: {
    length?: number;
    inset?: number;
  } & ShapeTerminatorOptions = {}) {
    super([
      0, 0,
      -1 * (options.length || width), width / 2,
      -1 * (1 - (options.inset || 0)) * (options.length || width), 0,
      -1 * (options.length || width), -1 * width / 2,
      0, 0,
    ], [
      -1 * (1 - (options.inset || 0)) * (options.length || width), 0
    ], options);
  }
}
