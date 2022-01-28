import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from '../../services/message-dialog.service';
import { CommonDialogComponent } from './common-dialog.component';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
})
export class ConfirmDialogComponent extends CommonDialogComponent {
  @Input() message: string;
  value: boolean;

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  setValue(value: boolean) {
    this.value = value;
  }

  getValue(): boolean {
    return this.value;
  }
}
