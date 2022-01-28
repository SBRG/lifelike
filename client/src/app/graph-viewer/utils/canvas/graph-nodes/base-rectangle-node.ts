import { PlacedNode } from 'app/graph-viewer/styles/styles';

import { pointOnRect } from '../../geometry';

export interface BaseRectangleNodeOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  padding?: number;
}

export abstract class BaseRectangleNode extends PlacedNode {

  protected defaultWidth = 100;
  protected defaultHeight = 100;
  readonly padding: number = 10;

  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  nodeWidth: number;
  nodeHeight: number;
  readonly nodeX: number;
  readonly nodeY: number;
  readonly nodeX2: number;
  readonly nodeY2: number;

  constructor(protected readonly ctx: CanvasRenderingContext2D, options: BaseRectangleNodeOptions) {
    super();
    Object.assign(this, options);

    this.nodeWidth = (this.width != null ? this.width : this.defaultWidth) + this.padding;
    this.nodeHeight = (this.height != null ? this.height : this.defaultHeight) + this.padding;
    this.nodeX = this.x - this.nodeWidth / 2;
    this.nodeY = this.y - this.nodeHeight / 2;
    this.nodeX2 = this.nodeX + this.nodeWidth;
    this.nodeY2 = this.nodeY + this.nodeHeight;
  }

  getBoundingBox() {
    return {
      minX: this.nodeX,
      minY: this.nodeY,
      maxX: this.nodeX2,
      maxY: this.nodeY2,
    };
  }

  isPointIntersecting(x: number, y: number): boolean {
    return x >= this.nodeX && x <= this.nodeX2 && y >= this.nodeY && y <= this.nodeY2;
  }

  isBBoxEnclosing(x0: number, y0: number, x1: number, y1: number): boolean {
    return x0 <= this.nodeX && y0 <= this.nodeY && x1 >= this.nodeX2 && y1 >= this.nodeY2;
  }

  lineIntersectionPoint(lineOriginX: number, lineOriginY: number): number[] {
    const {x, y} = pointOnRect(
      lineOriginX,
      lineOriginY,
      this.nodeX,
      this.nodeY,
      this.nodeX2,
      this.nodeY2,
      true,
    );
    return [x, y];
  }


}
