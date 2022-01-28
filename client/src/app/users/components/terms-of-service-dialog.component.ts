import { Component } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CommonDialogComponent } from 'app/shared/components/dialog/common-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';

@Component({
  selector: 'app-terms-of-service-dialog',
  templateUrl: './terms-of-service-dialog.component.html',
})
export class TermsOfServiceDialogComponent extends CommonDialogComponent {
  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): boolean {
    return true;
  }
}
