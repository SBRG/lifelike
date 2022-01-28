import { Injectable, OnDestroy } from '@angular/core';

import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

export interface TooltipDetails {
  posX: number;
  posY: number;
}

@Injectable()
export class TooltipControlService implements OnDestroy {

    private hideTooltipSource = new Subject<boolean>();
    private updatePopperSource = new Subject<TooltipDetails>();
    protected completeSubjectsSource = new Subject<boolean>();

    hideTooltip$: Observable<boolean>;
    updatePopper$: Observable<TooltipDetails>;

    constructor() {
        // The `takeUntil` here unsures that even if any subscribers to our subjects forget to unsubscribe, we
        // will always complete the subjects when the service is destroyed.
        this.hideTooltip$ = this.hideTooltipSource.asObservable().pipe(takeUntil(this.completeSubjectsSource));
        this.updatePopper$ = this.updatePopperSource.asObservable().pipe(takeUntil(this.completeSubjectsSource));
    }

    ngOnDestroy() {
        this.completeSubjectsSource.next(true);
    }

    hideTooltip() {
        this.hideTooltipSource.next(true);
    }

    showTooltip() {
        this.hideTooltipSource.next(false);
    }

    updatePopper(posX: number, posY: number) {
        this.updatePopperSource.next({posX, posY});
    }

}
