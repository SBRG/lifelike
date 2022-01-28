import { Component, Input, OnDestroy, AfterViewInit } from '@angular/core';

import { isNil } from 'lodash-es';
import { VirtualElement, Instance, createPopper, Options } from '@popperjs/core';



import { uuidv4 } from '../utils';

@Component({
  selector: 'app-tooltip',
  template: '<div id="tooltip">I am a Tooltip</div>',
  styles: [],
})
export class TooltipComponent implements AfterViewInit, OnDestroy {
    @Input() tooltipOptions: Partial<Options>;

    virtualElement: VirtualElement;
    popper: Instance;
    tooltip: HTMLElement;
    tooltipId: string;
    tooltipSelector: string; // Should be specified in any inheriting component's constructor

    constructor() {
        this.tooltipId = uuidv4();
    }

    ngAfterViewInit() {
        // Need to get the DOM element after the view as been created by Angular,
        // otherwise the element with the ID we're looking for might not exist.
        this.tooltip = document.getElementById(this.tooltipSelector);
        this.setupPopper();
    }

    ngOnDestroy() {
        // Popper could be undefined if component view is not initialized before being destroyed
        if (!isNil(this.popper)) {
            this.popper.destroy();
        }
    }

    generateRect(x = 0, y = 0) {
        return () => ({
            width: 0,
            height: 0,
            top: y,
            right: x,
            bottom: y,
            left: x,
        });
    }

    setupPopper() {
        this.virtualElement = {
            getBoundingClientRect: this.generateRect(),
        };
        this.popper = createPopper(this.virtualElement, this.tooltip, this.tooltipOptions);
    }

    updatePopper(posX: number, posY: number) {
        this.virtualElement.getBoundingClientRect = this.generateRect(posX, posY);
        this.popper.update();
    }

    showTooltip() {
        this.tooltip.style.display = 'block';
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
    }
}
