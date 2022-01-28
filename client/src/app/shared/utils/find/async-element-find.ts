import { escapeRegExp, isNil } from 'lodash-es';


import {
  NodeTextRange,
  nonStaticPositionPredicate,
  scrollRectIntoView,
  walkParentElements,
} from '../dom';
import { AsyncTextHighlighter } from '../dom/async-text-highlighter';
import { AsyncFindController } from './find-controller';

/**
 * A find controller for finding items within an element.
 */
export class AsyncElementFind implements AsyncFindController {

  private pendingJump = false;

  target: Element;
  // @ts-ignore
  resizeObserver = new ResizeObserver(this.redraw.bind(this));
  scrollToOffset = 100;
  query = '';
  protected readonly textFinder = new AsyncElementTextFinder(this.matchFind.bind(this), this.findGenerator);
  protected results: NodeTextRange[] = [];
  protected readonly highlighter = new AsyncTextHighlighter(document.body);
  protected activeQuery: string | undefined = null;
  protected index = -1;

  constructor(
    target: Element = null,
    private findGenerator: (root: Node, query: string) => IterableIterator<NodeTextRange | undefined> = null,
  ) {
    this.target = target;
  }

  isStarted(): boolean {
    return this.activeQuery != null;
  }

  tick() {
    this.textFinder.tick();
    this.highlighter.tick();
  }

  start() {
    if (this.target == null) {
      return;
    }

    // Start observing the new target
    this.resizeObserver.disconnect();
    this.resizeObserver.observe(this.target);

    // Make sure we put the highlights in the right container
    this.highlighter.container = this.findHighlightContainerElement(this.target);

    // Keep track of what the current find is for
    this.activeQuery = this.query;

    this.results = [];

    // Delete existing highlights
    this.highlighter.clear();

    // Start find process if needed
    if (this.query.length) {
      this.textFinder.find(this.target, this.query);
      this.pendingJump = true;
    } else {
      this.textFinder.stop();
    }

    this.index = 0;
  }

  stop() {
    this.activeQuery = null;
    this.results = [];
    this.resizeObserver.disconnect();
    this.textFinder.stop();
    this.highlighter.clear();
  }

  nextOrStart() {
    if (this.query.length && this.activeQuery === this.query) {
      this.next();
    } else {
      this.start();
    }
  }

  previous(): boolean {
    if (this.target == null) {
      return false;
    }

    if (!this.results.length) {
      return false;
    }

    this.leaveResult();
    this.index--;
    if (this.index < 0) {
      this.index = this.results.length - 1;
    }
    this.visitResult();
    return true;
  }

  next(): boolean {
    if (this.target == null) {
      return false;
    }

    if (!this.results.length) {
      return false;
    }

    this.leaveResult();
    this.index++;
    if (this.index >= this.results.length) {
      this.index = 0;
    }
    this.visitResult();
    return true;
  }

  redraw() {
    this.highlighter.redraw(this.results);
  }

  /**
   * Callback for when the async finder finds new entries.
   */
  private matchFind(matches: NodeTextRange[]) {
    this.highlighter.addAll(matches);
    this.results.push(...matches);

    if (this.pendingJump) {
      this.pendingJump = false;
      this.visitResult();
    }
  }

  private findHighlightContainerElement(start: Element): Element {
    // noinspection LoopStatementThatDoesntLoopJS
    for (const element of walkParentElements(start, nonStaticPositionPredicate)) {
      return element;
    }
    return document.body;
  }

  /**
   * No longer highlight the current find index.
   */
  private leaveResult() {
    this.highlighter.unfocus(this.results[this.index]);
  }

  /**
   * Highlight the current findindex.
   */
  private visitResult() {
    scrollRectIntoView(this.results[this.index].startNode.parentElement, undefined);
    this.highlighter.focus(this.results[this.index]);
  }

  getResultIndex(): number {
    return this.index;
  }

  getResultCount(): number {
    return this.results.length;
  }

}

/**
 * Asynchronously finds text in a document.
 */
class AsyncElementTextFinder {

  // TODO: Handle DOM changes mid-find

  private findQueue: IterableIterator<NodeTextRange> | undefined;
  findTimeBudget = 10;

  constructor(
    protected readonly callback: (matches: NodeTextRange[]) => void,
    private generator?: (root: Node, query: string) => IterableIterator<NodeTextRange | undefined>
  ) {
    if (isNil(this.generator)) {
      this.generator = this.defaultGenerator;
    }
  }

  find(root: Node, query: string) {
    this.findQueue = this.generator(root, query);
  }

  stop() {
    this.findQueue = null;
  }

  tick() {
    if (this.findQueue) {
      const startTime = window.performance.now();
      const results: NodeTextRange[] = [];

      while (true) {
        const result: IteratorResult<NodeTextRange | undefined> = this.findQueue.next();

        if (result.value != null) {
          results.push(result.value);
        }

        if (result.done) {
          // Finished finding!
          this.findQueue = null;
          break;
        }

        // Check find time budget and abort
        // We'll get back to this point on the next animation frame
        if (window.performance.now() - startTime > this.findTimeBudget) {
          break;
        }
      }

      if (results.length) {
        this.callback(results);
      }
    }
  }

  private* defaultGenerator(root: Node, query: string): IterableIterator<NodeTextRange | undefined> {
    const queue: Node[] = [
      root,
    ];

    while (queue.length !== 0) {
      const node = queue.shift();
      if (node == null) {
        break;
      }

      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          for (let child = node.firstChild; child; child = child.nextSibling) {
            queue.push(child);
          }
          break;

        case Node.TEXT_NODE:
          const regex = new RegExp(escapeRegExp(query), 'ig');
          while (true) {
            const match = regex.exec(node.nodeValue);
            if (match === null) {
              break;
            }
            yield {
              startNode: node,
              endNode: node,
              start: match.index,
              end: regex.lastIndex,
            };
          }
      }
    }
  }
}
