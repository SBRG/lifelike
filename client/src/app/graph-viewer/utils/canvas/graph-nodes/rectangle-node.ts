import 'canvas-plus';

import { TextElement } from '../text-element';
import { Line } from '../lines/lines';
import { BaseRectangleNode, BaseRectangleNodeOptions } from './base-rectangle-node';

export interface RectangleNodeOptions extends BaseRectangleNodeOptions {
  textbox: TextElement;
  shapeFillColor?: string;
  stroke?: Line;
  forceHighDetailLevel?: boolean;
}

/**
 * Draws a rectangle node.
 */
export class RectangleNode extends BaseRectangleNode {
  readonly resizable = true;
  readonly uniformlyResizable = false;

  readonly textbox: TextElement;
  readonly shapeFillColor: string;
  readonly stroke: Line | undefined;
  readonly forceHighDetailLevel = false;

  constructor(ctx: CanvasRenderingContext2D, options: RectangleNodeOptions) {
    super(ctx, options);
    this.nodeWidth = (this.width != null ? this.width : this.textbox.actualWidth) + this.padding;
    this.nodeHeight = (this.height != null ? this.height : this.textbox.actualHeight) + this.padding;
  }

  draw(transform: any): void {
    const ctx = this.ctx;
    const zoomResetScale = 1 / transform.scale(1).k;
    const highDetailLevel = this.forceHighDetailLevel || transform.k >= 0.35;

    if (highDetailLevel) {
      // Node shape
      ctx.save();
      (ctx as any).roundedRect(
        this.nodeX,
        this.nodeY,
        this.nodeWidth,
        this.nodeHeight,
        5,
      );
      if (this.shapeFillColor) {
        ctx.fillStyle = this.shapeFillColor;
        ctx.fill();
      }
      if (this.stroke) {
        this.stroke.setContext(ctx);
        ctx.lineWidth = zoomResetScale * ctx.lineWidth;
        ctx.stroke();
      }
      ctx.restore();

      // Node text
      this.textbox.drawCenteredAt(this.x, this.y);
    } else {
      // Node shape
      ctx.save();
      (ctx as any).roundedRect(
        this.nodeX,
        this.nodeY,
        this.nodeWidth,
        this.nodeHeight,
        3,
      );
      if (this.shapeFillColor) {
        ctx.fillStyle = this.shapeFillColor;
        ctx.fill();
      }
      if (this.stroke) {
        this.stroke.setContext(ctx);
        ctx.lineWidth = zoomResetScale * ctx.lineWidth;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
