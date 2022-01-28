import { Component } from '@angular/core';
import {
  FormGroup,
  FormControl,
  Validators,
} from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { UserCreationRequest } from 'app/interfaces';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from 'app/shared/constants';

@Component({
  selector: 'app-user-create-dialog',
  templateUrl: 'user-create-dialog.component.html',
})
export class UserCreateDialogComponent extends CommonFormDialogComponent {
  readonly form: FormGroup = new FormGroup({
    firstName: new FormControl('', Validators.required),
    lastName: new FormControl('', Validators.required),
    username: new FormControl('', Validators.required),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(MIN_PASSWORD_LENGTH),
      Validators.maxLength(MAX_PASSWORD_LENGTH)
    ]),
    email: new FormControl('', [Validators.required, Validators.email]),
    roles: new FormControl('user', Validators.required)
  });

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  getValue(): UserCreationRequest {
    return {
      ...this.form.value,
      createdByAdmin: true,
    };
  }
}
