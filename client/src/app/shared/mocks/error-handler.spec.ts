import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { ErrorHandler as ErrorHandlerService } from 'app/shared/services/error-handler.service';

import { ErrorLogMeta } from '../schemas/common';

@Injectable()
export class MockErrorHandler extends ErrorHandlerService {
  constructor() {
    super(undefined, undefined);
  }

  logError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    this.createUserError(error).subscribe(userError => {
      console.warn(userError, logInfo);
    });
  }

  showError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    this.logError(error, logInfo);

    this.createUserError(error).subscribe(userError => {
      throw userError;
    });
  }
}
