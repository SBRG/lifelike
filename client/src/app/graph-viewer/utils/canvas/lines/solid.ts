import { DrawnLine, Line, LineOptions } from './lines';

export class SolidLine implements Line {
  lineCap: CanvasLineCap = 'butt';

  constructor(readonly width: number,
              readonly style: string,
              readonly options: LineOptions = {}) {
    Object.assign(this, options);
  }

  draw(ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number): DrawnLine {
    ctx.save();
    this.setContext(ctx);
    ctx.stroke();
    ctx.restore();
    return {};
  }

  setContext(ctx: CanvasRenderingContext2D) {
    ctx.lineWidth = this.width;
    ctx.strokeStyle = this.style;
    ctx.lineCap = this.lineCap;
    ctx.setLineDash([]);
  }
}
