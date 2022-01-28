import { Injectable } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageType } from 'app/interfaces/message-dialog.interface';

import { MessageDialogComponent } from '../components/dialog/message-dialog.component';
import { ErrorLog } from '../schemas/common';

export interface MessageArguments extends ErrorLog {
  type: MessageType;
}

@Injectable({
  providedIn: 'root',
})
export class MessageDialog {
  constructor(
    private modalService: NgbModal,
  ) {
  }

  display(args: MessageArguments) {
    const modalRef = this.modalService.open(MessageDialogComponent, {
      size: args.stacktrace ? 'lg' : 'md',
    });
    modalRef.componentInstance.title = args.title;
    modalRef.componentInstance.message = args.message;
    modalRef.componentInstance.additionalMsgs = args.additionalMsgs;
    modalRef.componentInstance.stacktrace = args.stacktrace;
    modalRef.componentInstance.type = args.type;
    modalRef.componentInstance.transactionId = args.transactionId;
  }
}
