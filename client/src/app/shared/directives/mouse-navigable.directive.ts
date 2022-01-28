import {
  AfterViewInit,
  ContentChildren,
  Directive,
  ElementRef, EventEmitter,
  forwardRef,
  HostListener,
  Inject, Input,
  OnDestroy, Output,
  QueryList,
} from '@angular/core';

/**
 * Directive that marks a mouse-navigable item.
 */
@Directive({
  selector: '[appMouseNavigableItem]',
})
export class MouseNavigableItemDirective {
  constructor(@Inject(forwardRef(() => MouseNavigableDirective))
              protected readonly container: MouseNavigableDirective,
              protected readonly element: ElementRef) {
  }

  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.container.focusNext(this.element.nativeElement);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.container.focusPrevious(this.element.nativeElement);
    }
  }
}

/**
 * The container.
 */
@Directive({
  selector: '[appMouseNavigable]',
})
export class MouseNavigableDirective implements AfterViewInit, OnDestroy {
  @Input() navigationWrap = true;
  @Output() navigationEndReached = new EventEmitter<void>();
  @ContentChildren(MouseNavigableItemDirective, {read: ElementRef})
  protected childrenDirectives: QueryList<ElementRef>;

  constructor(protected readonly element: ElementRef) {
  }

  ngAfterViewInit() {
  }

  ngOnDestroy(): void {
  }

  getFirst(): HTMLElement | null {
    const first = this.childrenDirectives.first;
    return first != null ? first.nativeElement : null;
  }

  getLast(): HTMLElement | null {
    const last = this.childrenDirectives.last;
    return last != null ? last.nativeElement : null;
  }

  getPrevious(currentElement: HTMLElement, wrap = true): HTMLElement | null {
    const children = this.childrenDirectives.toArray();
    if (children.length <= 1) {
      return null;
    }
    const currentIndex = this.indexOfElement(children, currentElement);
    if (currentIndex != null) {
      let previousIndex = currentIndex - 1;
      if (previousIndex < 0) {
        if (wrap) {
          previousIndex = children.length - 1;
        } else {
          return null;
        }
      }
      return children[previousIndex].nativeElement;
    } else {
      return null;
    }
  }

  getNext(currentElement: HTMLElement, wrap = true): HTMLElement | null {
    const children = this.childrenDirectives.toArray();
    if (children.length <= 1) {
      return null;
    }
    const currentIndex = this.indexOfElement(children, currentElement);
    if (currentIndex != null) {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= children.length) {
        if (wrap) {
          nextIndex = 0;
        } else {
          return null;
        }
      }
      return children[nextIndex].nativeElement;
    } else {
      return null;
    }
  }

  private indexOfElement(children: ElementRef[], item: Element): number | undefined {
    for (let i = 0; i < children.length; i++) {
      if (children[i].nativeElement === item) {
        return i;
      }
    }
    return null;
  }

  focusPrevious(currentElement: HTMLElement) {
    const nextElement = this.getPrevious(currentElement, this.navigationWrap);
    if (nextElement != null) {
      nextElement.focus();
      nextElement.scrollIntoView();
    } else {
      this.navigationEndReached.next();
    }
  }

  focusNext(currentElement: HTMLElement) {
    const nextElement = this.getNext(currentElement, this.navigationWrap);
    if (nextElement != null) {
      nextElement.focus();
      nextElement.scrollIntoView();
    } else {
      this.navigationEndReached.next();
    }
  }
}
