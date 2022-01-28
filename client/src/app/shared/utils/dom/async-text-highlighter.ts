import { getBoundingClientRectRelativeToContainer, NodeTextRange } from '../dom';

/**
 * Highlights text in a document asynchronously.
 */
export class AsyncTextHighlighter {

  // TODO: Adjust throttling to reduce even minor freezing in browser during scroll

  renderTimeBudget = 1;
  protected readonly mapping: Map<Element, TextHighlight[]> = new Map();
  protected readonly intersectionObserver = new IntersectionObserver(this.intersectionChange.bind(this));
  protected readonly renderQueue = new Map<TextHighlight, (fragment: DocumentFragment) => any>();

  constructor(public container: Element) {
  }

  /**
   * Call this every render frame.
   */
  tick() {
    if (this.mapping.size) {
      const startTime = window.performance.now();
      const fragment = document.createDocumentFragment();

      for (const [highlight, func] of this.renderQueue.entries()) {
        func(fragment);
        this.renderQueue.delete(highlight);

        // Check find time budget and abort
        // We'll get back to this point on the next animation frame
        if (window.performance.now() - startTime > this.renderTimeBudget) {
          break;
        }
      }

      this.container.appendChild(fragment);
    }
  }

  addAll(entries: NodeTextRange[]) {
    let firstResult = true && !(this.mapping.size > 0);
    for (const entry of entries) {
      const element = entry.startNode.parentElement;

      let highlights = this.mapping.get(element);
      if (highlights == null) {
        highlights = [];
        this.mapping.set(element, highlights);
        this.intersectionObserver.observe(element);
      }

      highlights.push(new TextHighlight(entry.startNode, entry.endNode, entry.start, entry.end, firstResult));

      if (firstResult) {
        firstResult = false;
      }
    }
  }

  focus(entry: NodeTextRange) {
    const element = entry.startNode.parentElement;
    const highlights = this.mapping.get(element);

    for (const highlight of highlights) {
      if (highlight.start === entry.start && highlight.end === entry.end) {
        highlight.focusHighlights();
      }
    }
  }

  unfocus(entry: NodeTextRange) {
    const element = entry.startNode.parentElement;
    const highlights = this.mapping.get(element);

    for (const highlight of highlights) {
      if (highlight.start === entry.start && highlight.end === entry.end) {
        highlight.unfocusHighlights();
      }
    }
  }

  clear() {
    this.renderQueue.clear();
    this.intersectionObserver.disconnect();

    for (const highlights of this.mapping.values()) {
      for (const highlight of highlights) {
        highlight.removeHighlights();
      }
    }

    this.mapping.clear();
  }

  redraw(entries: NodeTextRange[]) {
    for (const entry of entries) {
      const element = entry.startNode.parentElement;
      const highlights = this.mapping.get(element);

      for (const highlight of highlights) {
        // Redrawing could result in new highlight boxes being drawn, so add the redraw to the render queue
        this.renderQueue.set(highlight, fragment => fragment.append(...highlight.redrawHighlights(this.container)));
      }
    }
  }

  private intersectionChange(entries: IntersectionObserverEntry[], observer: IntersectionObserver) {
    for (const entry of entries) {
      const highlights = this.mapping.get(entry.target);
      if (highlights != null) {
        for (const highlight of highlights) {
          if (entry.intersectionRatio > 0) {
            this.renderQueue.set(highlight, fragment => fragment.append(...highlight.createHighlights(this.container)));
          } else {
            this.renderQueue.set(highlight, () => highlight.removeHighlights());
          }
        }
      }
    }
  }

  get results() {
    return Array.from(this.mapping.values());
  }

  get length(): number {
    return this.mapping.size;
  }

}

class TextHighlight implements NodeTextRange {
  protected elements: Element[] = [];
  private focusOnNextRender = false;

  constructor(public readonly startNode: Node,
              public readonly endNode: Node,
              public readonly start: number,
              public readonly end: number,
              public readonly initialFocus: boolean) {
    this.focusOnNextRender = initialFocus;
  }

  get rects() {
    const range = document.createRange();
    range.setStart(this.startNode, this.start);
    range.setEnd(this.endNode, this.end); // IMPORTANT: the `end` param of `setEnd` is EXCLUSIVE!

    // Join the rects where it makes sense, otherwise we'll see a rect for each text node
    const tolerance = 0.5;
    const joinedRects = [];
    let joinRect: {x: number, y: number, width: number, height: number} = null;
    Array.from(range.getClientRects()).filter(
      // For some reason, we somestimes see rects generated for " " characters. This filter should remove these spurrious rects.
      // TODO: Because we are merging each rect, we may not need this filter. The downside to removing it is that we might have rects that
      // have a space at the end.
      (rect) => rect.width >= 3.6
    ).forEach((rect: DOMRect) => {
      if (joinRect === null) {
        joinRect = {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
      } else if (Math.abs(joinRect.y - rect.y) > tolerance) {
        // Looks like the current rect starts on a new line, so start a new join
        joinedRects.push(new DOMRect(joinRect.x, joinRect.y, joinRect.width, joinRect.height));
        joinRect = {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
      } else {
        // We sometimes see duplicate rects (not sure why, I think it's related to whitespace), so rather than adding the width of every
        // new rect, add the difference between the end of the new rect and the end of our joinRect.
        joinRect.width += (rect.x + rect.width) - (joinRect.x + joinRect.width);
        if (rect.height > joinRect.height) {
          joinRect.height = rect.height;
        }
      }
    });
    joinedRects.push(new DOMRect(joinRect.x, joinRect.y, joinRect.width, joinRect.height));
    return joinedRects;
  }

  createHighlights(container: Element): Element[] {
    const elements: Element[] = [];

    for (const rect of this.rects) {
      const relativeRect = getBoundingClientRectRelativeToContainer(rect, container);
      const el = document.createElement('div');
      el.className = this.focusOnNextRender ? 'highlight-block-focus' : 'highlight-block';
      el.style.position = 'absolute';
      el.style.top = relativeRect.y + 'px';
      el.style.left = relativeRect.x + 'px';
      el.style.width = relativeRect.width + 'px';
      el.style.height = relativeRect.height + 'px';
      elements.push(el);
      this.elements.push(el);
    }

    return elements;
  }

  redrawHighlights(container: Element) {
    const rects = this.rects;

    // Remove any elements which are no longer needed due to merging rects. A merge might happen if two rects were on two lines, but due
    // to resizing are now on one line.
    while (this.elements.length > rects.length) {
      this.elements.pop().remove();
    }

    // Then, update any existing elements
    for (const [i, el] of this.elements.entries()) {
      const htmlEl = el as HTMLElement;
      const relativeRect = getBoundingClientRectRelativeToContainer(rects[i], container);
      htmlEl.style.top = relativeRect.y + 'px';
      htmlEl.style.left = relativeRect.x + 'px';
      htmlEl.style.width = relativeRect.width + 'px';
      htmlEl.style.height = relativeRect.height + 'px';
    }

    // Finally, we may need to add new elements if resizing caused a line break, and one rect was broken into several.
    const newElements: Element[] = [];
    while (this.elements.length < rects.length) {
      const relativeRect = getBoundingClientRectRelativeToContainer(rects[this.elements.length], container);
      const el = document.createElement('div');
      el.className = this.focusOnNextRender ? 'highlight-block-focus' : 'highlight-block';
      el.style.position = 'absolute';
      el.style.top = relativeRect.y + 'px';
      el.style.left = relativeRect.x + 'px';
      el.style.width = relativeRect.width + 'px';
      el.style.height = relativeRect.height + 'px';
      newElements.push(el);
      this.elements.push(el);
    }

    return newElements;
  }

  /**
   * Immediately changes this highlight to use the focused styling. Also sets this highlight to be focused on future renders.
   */
  focusHighlights() {
    this.focusOnNextRender = true;
    for (const el of this.elements) {
      el.className = 'highlight-block-focus';
    }
  }

  /**
   * Immediately changes this highlight to use the unfocused styling. Also sets this highlight to be unfocused on future renders.
   */
  unfocusHighlights() {
    this.focusOnNextRender = false;
    for (const el of this.elements) {
      el.className = 'highlight-block';
    }
  }

  removeHighlights() {
    for (const el of this.elements) {
      el.remove();
    }
    this.elements = [];
  }
}
