/**
 * Manages the process of finding some text within something.
 */
export interface FindController {
  /**
   * The query to search for.
   */
  query: string;

  /**
   * Gets whether a find is in progress.
   */
  isStarted(): boolean;

  /**
   * Start a find.
   */
  start(): void;

  /**
   * Go to the next result if a find is active otherwise start a find.
   */
  nextOrStart();

  /**
   * Go to the previous result. Does nothing if no find is active.
   *
   * @return true if a find is active and there was a result
   */
  previous(): boolean;

  /**
   * Go to the next result. Does nothing if no find is active.
   *
   * @return true if a find is active and there was a result
   */
  next(): boolean;

  /**
   * In case of layout changes, update all highlight rectangles.
   */
  redraw(): void;

  /**
   * Get the current result index, from -1 to N-1. If it's -1, that means that the find
   * is not yet focused on a match.
   */
  getResultIndex(): number;

  /**
   * Get the number of matches.
   */
  getResultCount(): number;
}

/**
 * An async find implementation.
 */
export interface AsyncFindController extends FindController {

  tick(): void;

}
