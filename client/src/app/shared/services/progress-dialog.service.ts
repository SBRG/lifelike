import { Injectable } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { NgbModalOptions } from '@ng-bootstrap/ng-bootstrap/modal/modal-config';

import { Progress } from 'app/interfaces/common-dialog.interface';

import { ProgressDialogComponent } from '../components/dialog/progress-dialog.component';
import { openModal } from '../utils/modals';

export interface ProgressDialogArguments {
  title: string;
  progressObservables: Observable<Progress>[];
  onCancel?: () => void;
}

@Injectable({
  providedIn: 'root',
})
export class ProgressDialog {
  constructor(
    public modalService: NgbModal
  ) {
  }

  display(args: ProgressDialogArguments, options?: NgbModalOptions) {
    const modalRef = openModal(this.modalService, ProgressDialogComponent, options);
    modalRef.componentInstance.title = args.title;
    modalRef.componentInstance.progressObservables = args.progressObservables;
    modalRef.componentInstance.cancellable = !!args.onCancel;
    if (args.onCancel) {
      modalRef.componentInstance.progressCancel.subscribe(() => {
        args.onCancel();
      });
    }
    return modalRef;
  }
}
