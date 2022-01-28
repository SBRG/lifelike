import { DrawnLineHead, LineHead } from './line-heads';
import { transformControlPoint } from '../../geometry';

/**
 * A terminator that just takes up space.
 */
export class EmptyLineHead implements LineHead {
  /**
   * Create an instance.
   * @param spacing the amount of dead weight to take up
   */
  constructor(public spacing: number) {
  }

  draw(ctx: CanvasRenderingContext2D,
       startX: number,
       startY: number,
       endX: number,
       endY: number): DrawnLineHead {
    const startPoint = transformControlPoint(
      startX, startY, endX, endY, -1 * this.spacing, 0
    );
    return {
      startX: startPoint[0],
      startY: startPoint[1],
    };
  }
}
