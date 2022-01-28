import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';

import { FilesystemObject } from '../../models/filesystem-object';
import { ObjectVersion } from '../../models/object-version';

@Component({
  selector: 'app-object-version-history-dialog',
  templateUrl: './object-version-history-dialog.component.html',
})
export class ObjectVersionHistoryDialogComponent extends CommonFormDialogComponent {
  @Input() object: FilesystemObject;
  @Input() promptRestore = false;

  readonly form: FormGroup = new FormGroup({
    version: new FormControl(null, Validators.required),
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): ObjectVersion | null  {
    return this.form.get('version').value;
  }
}

