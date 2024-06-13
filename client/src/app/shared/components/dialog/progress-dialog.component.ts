import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { asyncScheduler, Observable, Subscription } from 'rxjs';
import { throttleTime } from 'rxjs/operators';

import {Progress, ProgressMode} from 'app/interfaces/common-dialog.interface';


/**
 * A dialog to indicate the progress of a process.
 */
@Component({
  selector: 'app-progress-dialog',
  templateUrl: './progress-dialog.component.html',
})
export class ProgressDialogComponent implements OnInit, OnDestroy {
  @Input() title: string;
  @Input()
  progressObservables: Observable<Progress>[];


  @Input() cancellable = false;
  @Output() readonly progressCancel = new EventEmitter<any>();
  /**
   * Periodically updated with the progress of the upload.
   */
  lastProgresses: Progress[] = [];


  private progressSubscription = new Subscription();


  constructor(public activeModal: NgbActiveModal) {
  }

  ngOnInit() {
    for (let i = 0; i < this.progressObservables.length; i++) {
      const progressObservable = this.progressObservables[i];
      this.lastProgresses.push(new Progress());
      this.progressSubscription.add(progressObservable
        .pipe(throttleTime(250, asyncScheduler, {
          leading: true,
          trailing: true,
        })) // The progress bar cannot be updated more than once every 250ms due to its CSS animation
        .subscribe(value => this.lastProgresses[i] = value));
    }
  }

  ngOnDestroy() {
    this.progressSubscription.unsubscribe();
  }

  cancel() {
    this.activeModal.dismiss();
    this.progressCancel.emit();
  }
}

export function getProgressStatus(event, loadingStatus: string, finishStatus: string): Progress {
  if (event.loaded >= event.total) {
    return new Progress({
      mode: ProgressMode.Buffer,
      status: loadingStatus,
      value: event.loaded / event.total,
    });
  }
  return new Progress({
      mode: ProgressMode.Determinate,
      status: finishStatus,
      value: event.loaded / event.total,
    });
}
