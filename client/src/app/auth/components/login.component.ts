import { Platform } from '@angular/cdk/platform';
import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

import { Store } from '@ngrx/store';
import { BehaviorSubject } from 'rxjs';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { catchError } from 'rxjs/operators';

import { State } from 'app/root-store';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { AccountService } from 'app/users/services/account.service';

import { AuthActions } from '../store';
import { ResetPasswordDialogComponent } from './reset-password-dialog.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  unsupportedBrowser: boolean;

  constructor(
    private store: Store<State>,
    private readonly messageDialog: MessageDialog,
    private readonly platform: Platform,
    private readonly modalService: NgbModal,
    private readonly progressDialog: ProgressDialog,
    private readonly snackBar: MatSnackBar,
    private readonly errorHandler: ErrorHandler,
    private readonly accountService: AccountService
  ) {
    this.unsupportedBrowser = this.platform.SAFARI; // Add additional browsers here as necessary
  }

  submit() {
    if (!this.form.invalid) {
      const {email, password} = this.form.value;

      this.store.dispatch(AuthActions.checkTermsOfService(
        {credential: {email, password}},
      ));

      this.form.get('password').reset('');
    } else {
      this.form.markAsDirty();
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      } as MessageArguments);
    }
  }

  displayResetDialog() {
    const modalRef = this.modalService.open(ResetPasswordDialogComponent);
    modalRef.result.then(email => {
      const progressDialogRef = this.progressDialog.display({
        title: `Sending request`,
        progressObservable: new BehaviorSubject<Progress>(new Progress({
          status: 'Sending request...',
        })),
      });
      this.accountService.resetPassword(email.email)
        .pipe()
        .subscribe(() => {
          progressDialogRef.close();
          this.snackBar.open(
            `An email has been sent with instructions to reset your password.\n
            If you do not receive the email after some time, please contact the administraction for help.`,
            'close',
            {duration: 5000},
          );
        }, () => {
          progressDialogRef.close();
          this.snackBar.open(
            `Unable to reset the password.\n
            Please try again or contact the administration if the issue persist.`,
            'close',
            {duration: 5000},
          );
        });
    }, () => {
    });
  }
}
