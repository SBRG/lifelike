import { Renderer2 } from '@angular/core';

export class DropdownController {
  fixedAnchorPoint = false;
  viewportSpacing = 5;
  focusAfterOpen = false;
  parentNode: Node | undefined;

  constructor(protected readonly renderer: Renderer2,
              protected readonly containerElement: HTMLElement,
              protected readonly dropdownElement: HTMLElement,
              options: DropdownOptions = {}) {
    Object.assign(this, options);
    this.parentNode = dropdownElement.parentNode;
  }

  /**
   * Move the menu back to the original container.
   */
  private removeFromBody() {
    this.renderer.appendChild(this.parentNode, this.dropdownElement);
  }

  /**
   * Move the menu to <body> so it doesn't get ruined by elements with overflow.
   */
  private placeInBody() {
    this.removeFromBody();
    this.renderer.appendChild(document.body, this.dropdownElement);
  }

  openRelative(element: HTMLElement, options: RelativeOpenOptions = {}) {
    const inputRect = element.getBoundingClientRect();
    const x = inputRect.left;
    const y = inputRect.top + element.offsetHeight;
    this.open(x, y, options);
  }

  open(x: number, y: number, options: OpenOptions = {}) {
    this.placeInBody();

    const dropdownElement = this.dropdownElement;

    // Need to show the element to measure it
    dropdownElement.classList.add('show');

    dropdownElement.style.left = x + 'px';
    dropdownElement.style.top = y + 'px';

    this.fit(options);

    if (this.focusAfterOpen) {
      // Deal with the fact that we move the menu to <body>, which screws up tabbing
      dropdownElement.setAttribute('tabindex', '-1');
      dropdownElement.focus();
      dropdownElement.setAttribute('tabindex', '');
    }
  }

  fit(options: FitOptions = {}) {
    const dropdownElement = this.dropdownElement;

    const viewportWidth = document.documentElement.clientWidth - this.viewportSpacing;
    const viewportHeight = document.documentElement.clientHeight - this.viewportSpacing;

    let {left, top} = dropdownElement.getBoundingClientRect();
    let width = dropdownElement.offsetWidth;
    let height = dropdownElement.offsetHeight;

    let forceWidth: number = null;
    let forceHeight: number = null;

    if (!this.fixedAnchorPoint) {
      let maxWidth = viewportWidth;
      if (options.maxWidth != null) {
        maxWidth = Math.min(maxWidth, viewportWidth - left);
      }
      if (width > maxWidth) {
        forceWidth = maxWidth;
        width = maxWidth;
      }

      if (height > viewportHeight) {
        forceHeight = viewportHeight;
        height = viewportHeight;
      }

      if (left + width > viewportWidth) {
        left += (viewportWidth - (left + width));
      }

      if (top + height > viewportHeight) {
        top += (viewportHeight - (top + height));
      }
    } else {
      let maxWidth = viewportWidth - left;
      if (options.maxWidth != null) {
        maxWidth = Math.min(maxWidth, options.maxWidth);
      }
      if (width > maxWidth) {
        forceWidth = maxWidth;
        width = maxWidth;
      }

      const maxHeight = viewportHeight - top;
      if (height > maxHeight) {
        forceHeight = maxHeight;
        height = maxHeight;
      }
    }

    if (forceWidth != null) {
      dropdownElement.style.width = forceWidth + 'px';
    }

    if (forceHeight != null) {
      dropdownElement.style.height = forceHeight + 'px';
    }
  }

  /**
   * Get rid of the menu.
   */
  close() {
    const dropdownElement = this.dropdownElement;
    dropdownElement.style.width = '';
    dropdownElement.style.height = '';
    dropdownElement.classList.remove('show');

    this.removeFromBody();
  }
}

export interface DropdownOptions {
  viewportSpacing?: number;
  focusAfterOpen?: boolean;
  fixedAnchorPoint?: boolean;
}

export type Placement = 'bottom-left';

export interface FitOptions {
  maxWidth?: number;
}

export type OpenOptions = FitOptions;

export interface RelativeOpenOptions extends OpenOptions {
  placement?: Placement;
}
