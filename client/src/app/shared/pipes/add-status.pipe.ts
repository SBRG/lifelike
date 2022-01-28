import { Pipe, PipeTransform } from '@angular/core';

import { concat, Observable, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';

@Pipe({
  name: 'addStatus',
})
export class AddStatusPipe implements PipeTransform {
  transform<T>(observable: Observable<T>): Observable<PipeStatus<T>> {
    return observable.pipe(
        map((value: any) => ({loading: false, value})),
        startWith({loading: true}),
        catchError(error => of({loading: false, error})),
    );
  }
}

export interface PipeStatus<T> {
  loading: boolean;
  value?: T;
  error?: any;
}

export function addStatus<T>(observable: Observable<T>): Observable<PipeStatus<T>> {
  return concat(
    of({loading: true}),
    observable.pipe(
      map(results => ({loading: false, value: results})),
      catchError(error => of({loading: false, error})),
    ),
  );
}
