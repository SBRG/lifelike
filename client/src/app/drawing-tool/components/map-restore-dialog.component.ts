import { Component, Input} from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CommonDialogComponent } from 'app/shared/components/dialog/common-dialog.component';

import {
  KnowledgeMap,
} from '../services/interfaces';

@Component({
  selector: 'app-map-restore-dialog',
  templateUrl: './map-restore-dialog.component.html',
})
export class MapRestoreDialogComponent extends CommonDialogComponent {
  @Input() map: KnowledgeMap;

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): boolean {
    return true;
  }
}
