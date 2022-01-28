import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CommonDialogComponent } from 'app/shared/components/dialog/common-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { DirectoryObject } from 'app/interfaces/projects.interface';

@Component({
  selector: 'app-deletion-result-dialog',
  templateUrl: './object-deletion-result-dialog.component.html',
})
export class ObjectDeletionResultDialogComponent extends CommonDialogComponent {
  @Input() failed: { object: DirectoryObject, message: string }[];

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): any {
  }
}
