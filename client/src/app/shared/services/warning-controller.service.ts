import { Injectable, OnDestroy } from '@angular/core';

import { BehaviorSubject } from 'rxjs';
import { transform, isBoolean } from 'lodash-es';

@Injectable()
export class WarningControllerService implements OnDestroy {
  warnings = new BehaviorSubject([]);
  currentWarnings = new BehaviorSubject([]);
  private wm = new Map();
  showUnique = true;

  private updateWarningList() {
    const next = transform(
      [...this.wm.entries()],
      (r, [warning, display]) => {
        if (display) {
          r.push(warning);
        }
      },
      []
    );
    this.currentWarnings.next(next);
    this.warnings.next([...this.wm.keys()]);
  }

  private closeExistingWarning(warning) {
    const existingWarning = this.wm.get(warning);
    if (existingWarning) {
      clearTimeout(existingWarning);
    }
  }

  warn(warning, hide: number | boolean = 5000) {
    if (this.showUnique && this.wm.has(warning)) {
      return;
    }
    this.closeExistingWarning(warning);
    const openStatus = isBoolean(hide) ? !hide : setTimeout(() => this.close(warning), hide);
    this.wm.set(warning, openStatus);
    this.updateWarningList();
  }

  assert(assertion, ...args: Parameters<WarningControllerService['warn']>) {
    if (!assertion) {
      return this.warn(...args);
    }
  }

  close(warning) {
    this.closeExistingWarning(warning);
    this.wm.set(warning, false);
    this.updateWarningList();
  }

  ngOnDestroy() {
    for (const timeoutId of this.wm.values()) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
