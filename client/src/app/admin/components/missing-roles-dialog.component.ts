import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject } from 'rxjs';

import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { AppUser, UserUpdateRequest } from 'app/interfaces';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { AccountService } from 'app/users/services/account.service';


@Component({
  selector: 'app-missing-roles-dialog',
  templateUrl: './missing-roles-dialog.component.html'
})
export class MissingRolesDialogComponent extends CommonFormDialogComponent {

  users: AppUser[];
  modified = false;

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              private readonly accountService: AccountService,
              private readonly progressDialog: ProgressDialog,
              private readonly snackBar: MatSnackBar,
              private readonly errorHandler: ErrorHandler) {
    super(modal, messageDialog);
    this.accountService = accountService;
  }

  updateAll() {
    for (const user of this.users) {
      this.fixMissingUserRole(user);
    }
  }

  close() {
    this.modal.close(this.getValue());
  }

  fixMissingUserRole(user: AppUser) {
    const updateRequest: UserUpdateRequest = {hashId: user.hashId, roles: ['user']};
    const progressDialogRef = this.progressDialog.display({
            title: `Updating User`,
            progressObservable: new BehaviorSubject<Progress>(new Progress({
              status: 'Updating user...',
            })),
          });
    this.accountService.updateUser(updateRequest)
    .pipe(this.errorHandler.create({label: 'Update user role'}))
    .subscribe(() => {
      progressDialogRef.close();
      this.modified = true;
      const index = this.users.indexOf(user);
      this.users.splice(index, 1);
      if (this.users.length === 0) {
      this.snackBar.open(
        `All roles fixed!`,
        'close',
        {duration: 5000},
      );
      this.close();
    } else {
        this.snackBar.open(
        `User ${user.username} role fixed!`,
        'close',
        {duration: 5000},
      );
    }
    }, () => {
      progressDialogRef.close();
    });
  }

  getValue(): boolean {
    return this.modified;
  }
}
