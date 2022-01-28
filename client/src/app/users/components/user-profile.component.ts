import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject } from 'rxjs';
import { select, Store } from '@ngrx/store';

import { AppUser, PrivateAppUser, UserUpdateRequest } from 'app/interfaces';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ResultList } from 'app/shared/schemas/common';
import { userUpdated } from 'app/auth/store/actions';
import { State } from 'app/root-store';
import { AuthActions, AuthSelectors } from 'app/auth/store';

import { AccountService } from '../services/account.service';


@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,

})
export class UserProfileComponent implements OnInit  {

  user: AppUser;

  form = new FormGroup({
    username: new FormControl({value: 'username', disabled: false}),
    firstName: new FormControl({value: 'First Name', disabled: false}),
    lastName: new FormControl({value: 'Last Name', disabled: false}),
    email: new FormControl({value: '', disabled: true}),
  });

  constructor(private readonly accountService: AccountService,
              private readonly progressDialog: ProgressDialog,
              private readonly snackBar: MatSnackBar,
              private readonly errorHandler: ErrorHandler,
              private store: Store<State>) {
  }

  ngOnInit() {
   this.store.pipe(select(AuthSelectors.selectAuthUser)).subscribe(user => {
     this.user = user;
     this.reset();
   });
  }

  getValue(): UserUpdateRequest {
    const userData = {hashId: this.user.hashId};
    Object.keys(this.form.controls)
            .forEach(key => {
                const currentControl = this.form.controls[key];
                if (currentControl.value !== this.user[key] && currentControl.value !== '') {
                        userData[key] = currentControl.value;
                }
            });
    return userData;
  }

  reset() {
    this.form.reset({
      username: this.user.username,
      firstName: this.user.firstName,
      lastName: this.user.lastName,
      email: this.user.email,
    });
  }


  submit() {
    const progressDialogRef = this.progressDialog.display({
            title: `Updating User`,
            progressObservable: new BehaviorSubject<Progress>(new Progress({
              status: 'Updating user...',
            })),
          });
    const updatedUser = this.getValue();
    // Data object containing one key (hash_id) -> no update data provided
    if (Object.keys(updatedUser).length === 1) {
      progressDialogRef.close();
      this.snackBar.open(
            `Provided data is either empty of unmodified!`,
            'close',
            {duration: 5000},
      );
      this.reset();
    } else {
      this.accountService.updateUser(updatedUser)
      .pipe(this.errorHandler.create({label: 'Update user'}))
      .subscribe(() => {
        progressDialogRef.close();
        this.user = {...this.user, ...updatedUser};
        this.store.dispatch(AuthActions.userUpdated(
            {user: this.user},
          ));
        this.snackBar.open(
          `You data has been updated successfully!`,
          'close',
          {duration: 5000},
        );
      }, () => {
        progressDialogRef.close();
      });
    }

  }

}
