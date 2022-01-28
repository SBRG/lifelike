import { transformControlPoint } from '../../geometry';
import { AbstractShapeHead, ShapeTerminatorOptions } from './line-heads';

/**
 * Draws a circle at the end of the line.
 */
export class CircleHead extends AbstractShapeHead {
  private readonly radius;
  private readonly centerControlPoint: [number, number];
  private readonly startControlPoint: [number, number];

  constructor(diameter: number,
              options: ShapeTerminatorOptions = {}) {
    super(options);
    this.radius = diameter / 2;
    this.centerControlPoint = [-1 * diameter / 2, 0];
    this.startControlPoint = [-1 * (2 * diameter / 2), 0];
  }

  createPath(ctx: CanvasRenderingContext2D,
             startX: number,
             startY: number,
             endX: number,
             endY: number): void {
    const [x, y] = transformControlPoint(startX, startY, endX, endY, ...this.centerControlPoint);
    ctx.arc(x, y, this.radius, 0, 2 * Math.PI);
  }

  getStartControlPoint(): [number, number] {
    return this.startControlPoint;
  }
}
