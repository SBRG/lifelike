import { AbstractControl } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from '../../services/message-dialog.service';

/**
 * An abstract component for dialogs.
 */
export abstract class CommonDialogComponent<T = any, V = T> {
  form: AbstractControl;
  /**
   * If you perform an action after the dialog returns a value via NgbModal.result,
   * but that action fails, the dialog will have been closed and the user will have
   * lost their work. As an alternative,
   * you can set this field and do the handling within your provided method, and if
   * your action fails, the dialog will stay open.
   * @param value a function to execute your action
   */
  accept: (T) => Promise<V> = value => Promise.resolve(value);

  constructor(public readonly modal: NgbActiveModal,
              public readonly messageDialog: MessageDialog) {
  }

  /**
   * Get the return value for submission.
   */
  abstract getValue(): T;

  applyValue(value: V) {
  }

  cancel() {
    this.modal.dismiss();
  }

  submit(): void {
    this.accept(this.getValue()).then(result => {
      this.applyValue(result);
      this.modal.close(result);
    }, () => {
    });
  }
}
