// tslint:disable-next-line:no-empty-interface
export interface DrawnLine {

}

export interface Line {
  /**
   * Update the given context with the properties that would make canvas-drawn
   * lines as closest as possible to the line that would be drawn with {@link draw}
   * @param ctx the drawing context
   */
  setContext(ctx: CanvasRenderingContext2D);

  /**
   * Draws the line at the provided position.
   * @param ctx the drawing context
   * @param startX the start X position
   * @param startY the start Y position
   * @param endX the end X position
   * @param endY the end Y position
   * @return metrics about the drawn line
   */
  draw(ctx: CanvasRenderingContext2D,
       startX: number,
       startY: number,
       endX: number,
       endY: number): DrawnLine;
}

export interface LineOptions {
  lineCap?: CanvasLineCap;
}
