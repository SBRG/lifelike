import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { AnnotationType } from 'app/shared/constants';

@Component({
  selector: 'app-annotation-exclude-dialog',
  templateUrl: './annotation-exclude-dialog.component.html',
})
export class AnnotationExcludeDialogComponent extends CommonFormDialogComponent {
  @Input() text: string;
  @Input() set type(type: AnnotationType) {
    if (type === AnnotationType.Gene || type === AnnotationType.Protein) {
      this.isGeneOrProtein = true;
      this.form.patchValue({
        isCaseInsensitive: false
      });
    }
  }
  readonly reasonChoices = [
    'Not an entity',
    'Wrong annotation type',
    'Exclude from the synonym list',
    'Incorrect context',
    'Other',
  ];

  readonly form: FormGroup = new FormGroup({
    reason: new FormControl(this.reasonChoices[0], Validators.required),
    comment: new FormControl(''),
    isCaseInsensitive: new FormControl(true),
    excludeGlobally: new FormControl(false),
  });
  isGeneOrProtein = false;

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue() {
    return {
      ...this.form.value,
    };
  }

  chooseReason(reason: string, checked: boolean) {
    if (checked) {
      this.form.get('reason').setValue(reason);
    }
  }
}
