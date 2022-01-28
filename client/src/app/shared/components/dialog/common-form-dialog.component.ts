import { AbstractControl } from '@angular/forms';

import { MessageType } from 'app/interfaces/message-dialog.interface';
import { MessageArguments } from 'app/shared/services/message-dialog.service';

import { CommonDialogComponent } from './common-dialog.component';

/**
 * An abstract component for dialogs that use forms.
 */
export abstract class CommonFormDialogComponent<T = any, V = T> extends CommonDialogComponent<T, V> {
  form: AbstractControl;

  submit(): void {
    if (!this.form.invalid) {
      super.submit();
    } else {
      this.form.markAsDirty();
      this.messageDialog.display({
        title: 'Invalid Input',
        message: 'There are some errors with your input.',
        type: MessageType.Error,
      } as MessageArguments);
    }
  }
}
