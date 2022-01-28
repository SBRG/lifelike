import { AbstractPathHead, ShapeTerminatorOptions } from './line-heads';

/**
 * Custom terminator using provided control points.
 */
export class CustomHead extends AbstractPathHead {
  private readonly controlPoints: number[];
  private readonly startControlPoint: [number, number];

  /**
   * Create a new instance.
   * @param controlPoints the control points of the shape
   * @param startControlPoint the start control point
   * @param options additional options
   */
  constructor(controlPoints: number[],
              startControlPoint: [number, number],
              options: ShapeTerminatorOptions = {}) {
    super(options);
    this.controlPoints = controlPoints;
    this.startControlPoint = startControlPoint;
  }

  getControlPoints(): number[] {
    return this.controlPoints;
  }

  getStartControlPoint(): [number, number] {
    return this.startControlPoint;
  }
}
