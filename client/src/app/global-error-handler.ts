import { HttpErrorResponse } from '@angular/common/http';
import { ErrorHandler, Injectable, Injector } from '@angular/core';

import { ErrorHandler as ErrorHandlerService } from 'app/shared/services/error-handler.service';

@Injectable()
/**
 * GlobalErrorHandler will handle ALL uncaught errors/exceptions. This includes
 * errors that only occur client side.
 */
export class GlobalErrorHandler implements ErrorHandler {
  constructor(protected readonly injector: Injector) {
  }

  // Used to prevent error dialogs for specific HTTP codes
  KNOWN_HTTP_ERROR_CODES = [0, 401];

  handleError(error: Error | HttpErrorResponse) {
    console.error('Lifelike encountered an error', error);

    const errorHandlerService = this.injector.get(ErrorHandlerService);
    try {
      if (!(error instanceof HttpErrorResponse && this.KNOWN_HTTP_ERROR_CODES.includes(error.status))) {
        errorHandlerService.logError(error, {label: 'Uncaught exception', expected: false});
      }
    } catch (e) {
      console.error('Failed to log Lifelike error', e);
    }
  }
}
