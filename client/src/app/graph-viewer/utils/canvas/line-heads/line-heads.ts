import { transformControlPoint, transformControlPoints } from '../../geometry';

/**
 * Contains metrics of the drawn terminator.
 */
export interface DrawnLineHead {
  /**
   * The start X position of the terminator. If the terminator is the
   * arrowhead, this would be the back of the arrow. The start position
   * should be touching the shape and not simply be the position on the
   * bounding box.
   */
  startX: number;
  /**
   * The start Y position of the terminator. If the terminator is the
   * arrowhead, this would be the back of the arrow. The start position
   * should be touching the shape and not simply be the position on the
   * bounding box.
   */
  startY: number;
}

/**
 * A renderer for a line end.
 */
export interface LineHead {
  /**
   * Draws the line end at the provided position.
   * @param ctx the drawing context
   * @param startX the start X position
   * @param startY the start Y position
   * @param endX the end X position
   * @param endY the end Y position
   * @return metrics about the drawn terminator
   */
  draw(ctx: CanvasRenderingContext2D,
       startX: number,
       startY: number,
       endX: number,
       endY: number): DrawnLineHead;
}

/**
 * Basic shape terminator fill options.
 */
export interface ShapeTerminatorOptions {
  fillStyle?: string;
  strokeStyle?: string;
  lineWidth?: number;
}

/**
 * Abstract class for a terminator handles the fill and stroke properties.
 */
export abstract class AbstractShapeHead implements LineHead {
  public fillStyle = '#000';
  public strokeStyle = null;
  public lineWidth = 1;

  /**
   * Create a new instance.
   * @param options additional options
   */
  constructor(options: ShapeTerminatorOptions = {}) {
    Object.assign(this, options);
  }

  /**
   * Get the line width considering whether stroke is even enabled.
   */
  get effectiveLineWidth(): number {
    return this.strokeStyle ? this.lineWidth : 0;
  }

  /**
   * Get the start control point of the terminator as x, y coordinates in a flat array.
   */
  abstract getStartControlPoint(): [number, number];

  /**
   * Draw the path.
   */
  abstract createPath(ctx: CanvasRenderingContext2D,
                      startX: number,
                      startY: number,
                      endX: number,
                      endY: number): void;

  /**
   * Get the start point.
   * @param ctx the drawing context
   * @param startX the start X position
   * @param startY the start Y position
   * @param endX the end X position
   * @param endY the end Y position
   * @return metrics about the drawn terminator
   */
  getStartPoint(ctx: CanvasRenderingContext2D,
                startX: number,
                startY: number,
                endX: number,
                endY: number): [number, number] {
    return transformControlPoint(startX, startY, endX, endY, ...this.getStartControlPoint());
  }

  draw(ctx: CanvasRenderingContext2D,
       startX: number,
       startY: number,
       endX: number,
       endY: number): DrawnLineHead {
    ctx.beginPath();

    // Create path
    this.createPath(ctx, startX, startY, endX, endY);

    // Properties
    ctx.lineWidth = this.lineWidth;
    if (this.fillStyle) {
      ctx.fillStyle = this.fillStyle;
    }
    if (this.strokeStyle) {
      ctx.strokeStyle = this.strokeStyle;
    }

    // Fill the shape
    if (this.fillStyle) {
      ctx.fill();
    }

    // Stroke the shape
    if (this.strokeStyle) {
      ctx.stroke();
    }

    // Get the returned metrics
    const [terminatorStartX, terminatorStartY] = this.getStartPoint(ctx, startX, startY, endX, endY);
    return {
      startX: terminatorStartX,
      startY: terminatorStartY,
    };
  }
}

/**
 * Abstract class for a terminator that is based on a drawn shape. Handles
 * fill style, stroke style, and line width properties calls stroke()
 * and fill() as necessary.
 */
export abstract class AbstractPathHead extends AbstractShapeHead {
  lineJoin: CanvasLineJoin = 'round';
  lineCap: CanvasLineCap = 'round';

  /**
   * Get the control points of the shape as a list of x, y coordinates in a flat array.
   */
  abstract getControlPoints(): number[];

  createPath(ctx: CanvasRenderingContext2D,
             startX: number,
             startY: number,
             endX: number,
             endY: number) {
    // Create path
    ctx.beginPath();
    ctx.lineJoin = this.lineJoin;
    ctx.lineCap = this.lineCap;
    for (const {x, y, i} of transformControlPoints(startX, startY, endX, endY, this.getControlPoints())) {
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
}
