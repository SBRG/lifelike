import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';

import { catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { Store } from '@ngrx/store';

import { State } from 'app/root-store/state';
import { SnackbarActions } from 'app/shared/store';
import { ErrorHandler} from 'app/shared/services/error-handler.service';

/**
 * HttpErrorInterceptor is used to intercept a request/response
 * and parse the error to display the actual error message
 * on the UI, instead of a generic error message.
 */
@Injectable()
export class HttpErrorInterceptor implements HttpInterceptor {

  constructor(
    private store: Store<State>,
    private errorHandler: ErrorHandler) {
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<any> {
    return next.handle(this.addLogHeader(req)).pipe(
      catchError((res: HttpErrorResponse) => {
        const statusCode = res.status;
        if (statusCode === 0) {
          this.store.dispatch(SnackbarActions.displaySnackbar({
            payload: {
              message: 'Your request couldn\'t go through due to a bad connection. ' +
                'Please check your Internet connection or try again later.',
              action: 'Dismiss',
              config: {
                verticalPosition: 'top',
                duration: 10000,
              },
            },
          }));
          return throwError(res);
        } else if (statusCode >= 400) {
          return throwError(res);
        }
        return throwError(res);
      }),
    );
  }

  addLogHeader(request: HttpRequest<any>) {
    const transactionId = this.errorHandler.createTransactionId();
    return request.clone({setHeaders: {'X-Transaction-ID': transactionId}});
  }
}
