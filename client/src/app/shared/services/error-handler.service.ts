import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl } from '@angular/forms';

import { isNil } from 'lodash-es';
import { EMPTY, Observable, of, pipe, throwError } from 'rxjs';
import { catchError, first, map, mergeMap } from 'rxjs/operators';
import { UnaryFunction } from 'rxjs/internal/types';

import { MessageType } from 'app/interfaces/message-dialog.interface';

import { MessageDialog } from './message-dialog.service';
import { UserError } from '../exceptions';
import { LoggingService } from '../services/logging.service';
import { ErrorLogMeta, ErrorResponse } from '../schemas/common';
import { mapBlobToBuffer, mapBufferToJson } from '../utils/files';

@Injectable({
  providedIn: 'root',
})
export class ErrorHandler {
  constructor(
    private readonly messageDialog: MessageDialog,
    private readonly loggingService: LoggingService,
  ) {
  }

  createTransactionId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getErrorResponse(error: any): Observable<ErrorResponse | undefined> {
    if (error instanceof HttpErrorResponse) {
      const httpErrorResponse = error as HttpErrorResponse;
      if (typeof httpErrorResponse.error === 'string') {
        try {
          return of(JSON.parse(httpErrorResponse.error));
        } catch (e) {
          // Not an error response object
        }
      } else if (httpErrorResponse.error instanceof Blob) {
        return of(httpErrorResponse.error).pipe(
          mapBlobToBuffer(),
          mapBufferToJson<ErrorResponse | undefined>(),
          catchError(() => of(null)), // If JSON parsing fails, just go back to default behavior
        );
      } else if (typeof httpErrorResponse.error === 'object') {
        return of(httpErrorResponse.error);
      }
    }
    return of(null);
  }

  createUserError(error: any, options: { transactionId?: string } = {}): Observable<UserError> {
    let errorResponse$: Observable<ErrorResponse | null>;

    if (error instanceof HttpErrorResponse) {
      errorResponse$ = this.getErrorResponse(error);
    } else {
      errorResponse$ = of(null);
    }

    return errorResponse$.pipe(
      mergeMap(errorResponse => {
        let title = 'We\'re sorry!';
        let message = 'Looks like something went wrong on our end! Please try again in a moment.';
        let additionalMsgs = [];
        let stacktrace = null;
        // A transaction id for log audits with Sentry (Sentry.io)
        let transactionId = options.transactionId != null ? options.transactionId : 'L-' + this.createTransactionId();

        if (error instanceof HttpErrorResponse) {
          const httpErrorResponse = error as HttpErrorResponse;

          // Detect if we got an error response object
          if (errorResponse && errorResponse.message) {
            title = errorResponse.title;
            message = errorResponse.message;
            additionalMsgs = errorResponse.additionalMsgs;
            stacktrace = errorResponse.stacktrace;
            transactionId = 'R-' + errorResponse.transactionId;
          }

          // Override some fields for some error codes
          if (httpErrorResponse.status === 404) {
            message = 'The page that you are looking for does not exist. You may have ' +
              'followed a broken link or the page may have been removed.';
          } else if (httpErrorResponse.status === 413) {
            message = 'The server could not process your upload because it was too large.';
          }
        } else if (error instanceof UserError) {
          const userError = error as UserError;

          title = userError.title;
          message = userError.message;
          additionalMsgs = userError.additionalMsgs;
          stacktrace = userError.stacktrace;
          transactionId = userError.transactionId;

          if (error.cause != null) {
            return this.createUserError(error.cause).pipe(
              map(causeUserError => {
                if (causeUserError.stacktrace != null) {
                  if (stacktrace != null) {
                    stacktrace = stacktrace + '\n\n------------------------------\n\n' + causeUserError.stacktrace;
                  } else {
                    stacktrace = causeUserError.stacktrace;
                  }
                }

                return new UserError(
                  title, message, additionalMsgs, stacktrace, error, transactionId);
              }),
            );
          }
        } else if (error instanceof Error) {
          const errorObject = error as Error;
          stacktrace = errorObject.message;

          if (errorObject.stack) {
            stacktrace += '\n\n' + errorObject.stack;
          }
        } else {
          stacktrace = error + '';
        }

        return of(new UserError(
          title, message, additionalMsgs, stacktrace, error, transactionId));
      }),
    );
  }

  logError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    this.createUserError(error).subscribe(userError => {
      const {title, message, additionalMsgs, stacktrace, transactionId} = userError;

      this.loggingService.sendLogs(
        {title, message, additionalMsgs, stacktrace, transactionId, ...logInfo},
      ).pipe(
        first(),
        catchError(() => EMPTY),
      ).subscribe();
    });
  }

  showError(error: Error | HttpErrorResponse, logInfo?: ErrorLogMeta) {
    this.logError(error, logInfo);

    this.createUserError(error).subscribe(userError => {
      const {title, message, additionalMsgs, stacktrace, transactionId} = userError;

      this.messageDialog.display({
        title,
        message,
        additionalMsgs,
        stacktrace,
        transactionId,
        type: MessageType.Error,
      });
    });
  }

  createCallback<T>(logInfo?: ErrorLogMeta): (e: any) => void {
    return error => {
      if (isNil(logInfo)) {
        this.showError(error);
      } else {
        this.showError(error, logInfo);
      }
    };
  }

  create<T>(logInfo?: ErrorLogMeta): UnaryFunction<Observable<T>, Observable<T>> {
    return pipe(catchError(error => {
      if (isNil(logInfo)) {
        this.showError(error);
      } else {
        this.showError(error, logInfo);
      }
      return throwError(error);
    }));
  }

  createFormErrorHandler<T>(form: AbstractControl,
                            apiFieldToFormFieldMapping = {}): UnaryFunction<Observable<T>, Observable<T>> {
    return pipe(catchError(error => {
      this.getErrorResponse(error).subscribe(errorResponse => {
        if (errorResponse && errorResponse.fields) {
          const remainingErrors: string[] = [];

          for (const apiFieldKey of Object.keys(errorResponse.fields)) {
            const formFieldKey = apiFieldToFormFieldMapping[apiFieldKey] || apiFieldKey;
            const field = form.get(formFieldKey);
            if (field != null) {
              field.setErrors({
                serverValidated: errorResponse.fields[apiFieldKey],
              });
            } else {
              for (const errorMessage of errorResponse.fields[apiFieldKey]) {
                remainingErrors.push(errorMessage);
              }
            }
          }

          if (remainingErrors.length) {
            form.setErrors({
              serverValidated: remainingErrors,
            });
          }
        }
      });

      return throwError(error);
    }));
  }
}
