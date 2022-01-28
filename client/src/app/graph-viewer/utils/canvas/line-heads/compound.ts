import { DrawnLineHead, LineHead } from './line-heads';

/**
 * A terminator that combines other terminators end-to-end.
 */
export class CompoundLineHead implements LineHead {
  /**
   * Create a new instance.
   * @param children list of terminators, whether the first one is at the end
   */
  constructor(public children: LineHead[]) {
  }

  draw(ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) {
    let lastEnd: DrawnLineHead = {startX: endX, startY: endY};
    for (const child of this.children) {
      lastEnd = child.draw(ctx, startX, startY, lastEnd.startX, lastEnd.startY);
    }
    return lastEnd;
  }
}
