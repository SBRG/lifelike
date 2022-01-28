import { Component, Input, HostBinding } from '@angular/core';

import { Observable, of } from 'rxjs';

import { MessageType } from 'app/interfaces/message-dialog.interface';

import { UserError } from '../exceptions';
import { ErrorHandler } from '../services/error-handler.service';

@Component({
  selector: 'app-module-error',
  templateUrl: './module-error.component.html',
  styleUrls: [
    './module-error.component.scss'
  ],
})
export class ModuleErrorComponent {
  @HostBinding('class') @Input() class = 'position-absolute w-100 h-100 bg-white p-4';
  userError$: Observable<UserError>;
  messageType = MessageType;
  type: MessageType;

  constructor(protected readonly errorHandler: ErrorHandler) {
  }

  @Input()
  set error(error: any) {
    if (error != null) {
      // This error is not logged so we don't have a transaction ID
      this.userError$ = this.errorHandler.createUserError(error, {transactionId: ''});
      if (error.status >= 500) {
        this.type = this.messageType.Error;
      }
    } else {
      this.userError$ = of(null);
    }
  }
}
