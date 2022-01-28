import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageType } from 'app/interfaces/message-dialog.interface';

/**
 * A generic alert dialog.
 */
@Component({
  selector: 'app-message-dialog',
  templateUrl: './message-dialog.component.html',
  styleUrls: ['./message-dialog.component.scss'],
})
export class MessageDialogComponent {
  @Input() title: string;
  @Input() message: string;
  @Input() additionalMsgs: string[];
  @Input() stacktrace: string;
  @Input() transactionId: string;
  @Input() type: MessageType;

  constructor(
    private readonly modal: NgbActiveModal,
  ) {
  }

  dismiss() {
    this.modal.dismiss();
  }

  close() {
    this.modal.close();
  }
}
