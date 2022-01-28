import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { AuthenticationInterceptor } from './auth-interceptor';
import { HttpErrorInterceptor } from './http-error-interceptor';

/**
 * Note! These interceptors are order specific and important. The first in the array
 * will be handled before the next.
 */
export const httpInterceptorProviders = [
  {provide: HTTP_INTERCEPTORS, useClass: AuthenticationInterceptor, multi: true},
  {provide: HTTP_INTERCEPTORS, useClass: HttpErrorInterceptor, multi: true},
];
