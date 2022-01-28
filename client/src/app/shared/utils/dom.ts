/**
 * Shim to create a duck typed DOMRect because the DOMRect constructor is not supported everywhere.
 *
 * @param x the x
 * @param y the y
 * @param width width of the rect
 * @param height the height of the rect
 */
function createDOMRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON(): any {
      return JSON.stringify(this);
    },
  };
}

/**
 * Get the bounding client rect for an element considering scroll.
 *
 * @param element the element
 * @param rect a rect to use (otherwise the element's rect is used)
 */
export function getAbsoluteBoundingClientRect(element: Element, rect: DOMRect | undefined = null): DOMRect | ClientRect {
  if (rect == null) {
    rect = element.getBoundingClientRect() as DOMRect;
  }
  let offsetX = window.scrollX;
  let offsetY = window.scrollY;

  if (element !== document.body) {
    let parent: Element = element.parentElement;

    while (parent !== document.body) {
      offsetX += parent.scrollLeft;
      offsetY += parent.scrollTop;
      parent = parent.parentElement;
    }
  }

  const x = rect.left + offsetX;
  const y = rect.top + offsetY;

  return createDOMRect(x, y, rect.width, rect.height);
}

/**
 * Get a DOMRect with its coordinates relative to the given container.
 *
 * @param rect the rect to make relative
 * @param container the container (may be scrollable)
 */
export function getBoundingClientRectRelativeToContainer(rect: (DOMRect | ClientRect), container: Element): DOMRect {
  const containerRect = getAbsoluteBoundingClientRect(container);
  return createDOMRect(
    rect.left - containerRect.left + container.scrollLeft,
    rect.top - containerRect.top + container.scrollTop,
    rect.width,
    rect.height,
  );
}

/**
 * Generator to walk through all parent elements in a tree, starting from a given element,
 * and yield all elements that pass a given predicate function, and still continuing if an
 * element gets a false from the predicate (unless specified otherwise).
 *
 * @param start the element to start from, which is also tested for the predicate
 * @param predicate the test element
 * @param continueAfterFail true to continue walking the whole hierarchy even after predicate failure
 */
export function* walkParentElements(start: Element,
                                    predicate: (element: Element) => boolean,
                                    continueAfterFail = true): Iterable<Element | undefined> {
  let current: Element = start;
  while (current) {
    if (predicate(current)) {
      yield current;
    } else {
      if (!continueAfterFail) {
        break;
      }
    }
    current = current.parentElement;
  }
}

export function* walkOverflowElementPairs(start: Element): Iterable<{ target: Element, viewport: Element } | undefined> {
  let current: Element = start.parentElement;
  let target: Element = start;
  while (current) {
    if (nonStaticPositionPredicate(current)) {
      yield {target, viewport: current};
      target = current;
    }
    current = current.parentElement;
  }
}

/**
 * A predicate that tests whether an element has a position that makes children elements
 * within have a position relative to the given element.
 *
 * @param element the given element
 */
export const nonStaticPositionPredicate = (element: Element): boolean => {
  const position = window.getComputedStyle(element).getPropertyValue('position');
  return position === 'absolute' || position === 'fixed' || position === 'relative';
};

export function* walkElementVisibility(owner: Element, ownerRect: DOMRect | undefined): Iterable<ElementVisibility> {
  ownerRect = (ownerRect || owner.getBoundingClientRect()) as DOMRect;

  // TODO: NOT QUITE RIGHT - not sure it gets the right parent container that the scrollbar is from

  let index = 0;
  for (const {target, viewport} of walkOverflowElementPairs(owner)) {
    const viewportRect = viewport.getBoundingClientRect() as DOMRect;
    const viewportLeft = viewport.scrollLeft;
    const viewportRight = viewport.scrollLeft + viewportRect.width;
    const viewportTop = viewport.scrollTop;
    const viewportBottom = viewport.scrollTop + viewportRect.height;

    const relativeRect = getBoundingClientRectRelativeToContainer(
      index === 0 ? ownerRect : target.getBoundingClientRect() as DOMRect, viewport,
    );

    // Check if the element is viewable so we can decide if we need to scroll
    const fullyVisibleX = relativeRect.left >= viewportLeft && relativeRect.right <= viewportRight;
    const fullyVisibleXIfNoHorizontalScroll = relativeRect.right <= viewportRect.width;
    const fullyVisibleY = relativeRect.top >= viewportTop && relativeRect.bottom <= viewportBottom;
    const partiallyVisibleX = !(relativeRect.right < viewportLeft || relativeRect.left > viewportRight);
    const partiallyVisibleY = !(relativeRect.bottom < viewportTop || relativeRect.top > viewportBottom);

    yield {
      target,
      targetRelativeRect: relativeRect,
      viewport,
      viewportRect,
      fullyVisibleX,
      fullyVisibleXIfNoHorizontalScroll,
      fullyVisibleY,
      partiallyVisibleX,
      partiallyVisibleY,
    };

    index++;
  }
}

export interface ElementVisibility {
  target: Element;
  targetRelativeRect: DOMRect;
  viewport: Element;
  viewportRect: DOMRect;
  fullyVisibleX: boolean;
  fullyVisibleXIfNoHorizontalScroll: boolean;
  fullyVisibleY: boolean;
  partiallyVisibleX: boolean;
  partiallyVisibleY: boolean;
}

/**
 * Scroll the given DOMRect of an element into view.
 *
 * @param owner the element that the DOMRect is from
 * @param ownerRect the DOMRect (if not specified, the boundaries of the owner element are used)
 * @param options options for the scroll
 */
export function scrollRectIntoView(owner: Element, ownerRect: DOMRect | undefined,
                                   options: ScrollRectIntoViewOptions = {}) {
  options = {...defaultScrollRectIntoViewOptions, ...options};

  let index = 0;
  for (const {targetRelativeRect, viewport, viewportRect, fullyVisibleX, fullyVisibleXIfNoHorizontalScroll, fullyVisibleY} of
    walkElementVisibility(owner, ownerRect)) {

    // Handle the viewport being too small for the provided inset
    const insetX = options.inset <= viewportRect.width ? options.inset : viewportRect.width / 4;
    const insetY = options.inset <= viewportRect.height ? options.inset : viewportRect.height / 4;

    if (!fullyVisibleX) {
      // Bias to having no horizontal scroll offset
      if (index === 0 && options.preferNoHorizontalScroll && fullyVisibleXIfNoHorizontalScroll) {
        viewport.scrollLeft = 0;
      } else {
        viewport.scrollLeft = Math.max(0, targetRelativeRect.left - insetX);
      }
    }

    if (!fullyVisibleY) {
      viewport.scrollTop = Math.max(0, targetRelativeRect.top - insetY);

      // Bias to having no horizontal scroll offset
      if (index === 0 && options.preferNoHorizontalScroll && fullyVisibleXIfNoHorizontalScroll) {
        viewport.scrollLeft = 0;
      }
    }

    index++;
  }
}

export interface ScrollRectIntoViewOptions {
  /**
   * The viewport inset when we need to scroll. This value may be adjusted if the
   * viewport is smaller than the inset.
   */
  inset?: number;
  /**
   * If set to true, whenever we need to force a scroll, set the horizontal scroll
   * offset to 0 if it's possible. The rationale is that leaving a little bit of left
   * scroll can be confusing (especially if we are navigating through find results) so we want
   * to get rid of it whenever possible.
   */
  preferNoHorizontalScroll?: boolean;
}

const defaultScrollRectIntoViewOptions: ScrollRectIntoViewOptions = {
  inset: 100,
  preferNoHorizontalScroll: true,
};

export interface NodeTextRange {
  // Start and end node could refer to the same element!
  startNode: Node;
  endNode: Node;
  start: number;
  end: number;
}
