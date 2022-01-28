import {
  AfterViewInit,
  ContentChild,
  Directive,
  ElementRef, EventEmitter,
  forwardRef,
  HostBinding,
  HostListener,
  Inject,
  NgZone,
  OnDestroy, Output,
  Renderer2,
} from '@angular/core';

import { fromEvent, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { DropdownController } from '../utils/dom/dropdown-controller';

/**
 * Directive that marks the body of a context menu.
 */
@Directive({
  selector: '[appContextMenuBody]',
})
export class ContextMenuBodyDirective {
  /**
   * Sets the styles for the menu and also sets display: none.
   */
  @HostBinding('class.dropdown-menu') _dropdownMenuClass = true;
  @HostBinding('class.context-menu-body') _contextMenuBodyClass = true;
  /**
   * Makes the menu scrollable if the viewport is too small.
   */
  @HostBinding('style.overflow') _overflowStyle = 'auto';

  constructor(@Inject(forwardRef(() => ContextMenuDirective))
              readonly contextMenu: ContextMenuDirective) {
  }
}

/**
 * The context menu.
 */
@Directive({
  selector: '[appContextMenu]',
})
export class ContextMenuDirective implements AfterViewInit, OnDestroy {
  @ContentChild(ContextMenuBodyDirective, {static: false, read: ElementRef})
  private bodyDirective: ElementRef;

  @Output() contextMenuOpened = new EventEmitter<any>();

  private _open = false;
  protected readonly subscriptions = new Subscription();
  protected mousePosition = [0, 0];
  private mouseMovedBound = this.mouseMoved.bind(this);
  protected dropdownController: DropdownController;

  constructor(protected readonly element: ElementRef,
              protected readonly renderer: Renderer2,
              protected readonly ngZone: NgZone) {
  }

  ngAfterViewInit() {
    this.dropdownController = new DropdownController(
      this.renderer,
      this.element.nativeElement,
      this.bodyDirective.nativeElement, {
        viewportSpacing: 5,
        focusAfterOpen: true,
      },
    );

    // This forces all context menus to close on any right click, so we don't need to
    // keep track of which context menu is supposed to be open, although this means you cannot
    // right click on the contents of context menus
    this.subscriptions.add(fromEvent(document.body, 'contextmenu', {
      capture: true,
    }).pipe(map(() => this.open = false)).subscribe());

    this.ngZone.runOutsideAngular(() => {
      // Register this event outside because NgZone may be slow
      document.addEventListener('mousemove', this.mouseMovedBound);
    });
  }

  ngOnDestroy(): void {
    this.dropdownController.close();
    this.subscriptions.unsubscribe();
    document.removeEventListener('mousemove', this.mouseMovedBound);
  }

  get open(): boolean {
    return this._open;
  }

  set open(open: boolean) {
    const wasOpen = this._open;
    this._open = open;
    if (open) {
      this.showBody();
    } else {
      if (wasOpen) {
        this.hideBody();
      }
    }
  }

  toggle() {
    this.open = !this.open;
  }

  /**
   * Listener to track where the mouse was last.
   * @param e the event
   */
  mouseMoved(e: MouseEvent) {
    this.mousePosition = [e.pageX, e.pageY];
  }

  @HostListener('window:resize', ['$event'])
  windowResized(e: MouseEvent) {
    this.open = false;
  }

  @HostListener('contextmenu', ['$event'])
  contextMenuClicked(e) {
    e.stopPropagation();
    e.preventDefault();
    this.open = true;
  }

  @HostListener('document:click', ['$event'])
  documentClicked(e: MouseEvent) {
    this.open = false;
  }

  /**
   * Internal method to show and position the dropdown. Can be called when already open.
   */
  private showBody() {
    const x = this.mousePosition[0];
    const y = this.mousePosition[1];
    this.dropdownController.open(x, y);
    this.contextMenuOpened.emit();
  }

  /**
   * Get rid of the menu.
   */
  private hideBody() {
    this.dropdownController.close();
  }
}
