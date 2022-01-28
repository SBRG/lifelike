import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { asyncScheduler, Observable, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

import { Progress } from 'app/interfaces/common-dialog.interface';


/**
 * A dialog to indicate the progress of a process.
 */
@Component({
  selector: 'app-progress-dialog',
  templateUrl: './progress-dialog.component.html',
})
export class ProgressDialogComponent implements OnInit, OnDestroy {
  @Input() title: string;
  @Input() progressObservable: Observable<Progress>;
  @Input() cancellable = false;
  @Output() readonly progressCancel = new EventEmitter<any>();
  progressSubscription: Subscription;
  /**
   * Periodically updated with the progress of the upload.
   */
  lastProgress: Progress = new Progress();

  constructor(public activeModal: NgbActiveModal) {
  }

  ngOnInit() {
    this.progressSubscription = this.progressObservable
      .pipe(throttleTime(250, asyncScheduler, {
        leading: true,
        trailing: true,
      })) // The progress bar cannot be updated more than once every 250ms due to its CSS animation
      .subscribe(value => this.lastProgress = value);
  }

  ngOnDestroy() {
    if (this.progressSubscription != null) {
      this.progressSubscription.unsubscribe();
    }
  }

  cancel() {
    this.activeModal.dismiss();
    this.progressCancel.emit();
  }
}
