import { Directive, EventEmitter, HostBinding, HostListener, Output } from '@angular/core';

/**
 * Apply this directive to elements that you should be able to tab to and select by
 * pressing the enter key or by clicking on it.
 */
@Directive({
  selector: '[appTabSelectable]',
})
export class TabSelectableDirective {
  @Output() appTabSelectable = new EventEmitter<void>();
  @HostBinding('tabindex') tabIndex = '0';

  @HostListener('click')
  click() {
    this.appTabSelectable.emit();
  }

  @HostListener('keydown', ['$event'])
  keyDown(event: KeyboardEvent) {
    if (event.code === 'Enter' || event.code === 'Space') {
      this.appTabSelectable.emit();
    }
  }
}
