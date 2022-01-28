import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { FilesystemObject } from '../models/filesystem-object';
import { ObjectVersion, ObjectVersionHistory } from '../models/object-version';
import { FilesystemService } from '../services/filesystem.service';

@Component({
  selector: 'app-object-version-history',
  templateUrl: './object-version-history.component.html',
  styleUrls: [
    './object-version-history.component.scss',
  ],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: ObjectVersionHistoryComponent,
    multi: true,
  }],
})
export class ObjectVersionHistoryComponent implements ControlValueAccessor {

  _object: FilesystemObject;
  page = 1;
  @Input() limit = 20;
  @Input() showCheckboxes = true;
  log$: Observable<ObjectVersionHistory> = from([]);
  private changeCallback: any;
  private touchCallback: any;
  _history: ObjectVersionHistory;

  constructor(protected readonly filesystemService: FilesystemService,
              protected readonly errorHandler: ErrorHandler) {
  }

  @Input()
  set object(value: FilesystemObject | undefined) {
    this._object = value;
    this.refresh();
  }

  get object() {
    return this._object;
  }

  refresh() {
    this.log$ = this.object ? this.filesystemService.getVersionHistory(this.object.hashId, {
      page: this.page,
      limit: this.limit,
    }).pipe(
      map(history => {
        this._history = history;
        history.results.multipleSelection = false;
        history.results.selectionChanges$.subscribe(change => {
          for (const version of change.added) {
            if (!version.contentValue) {
              this.filesystemService.getVersionContent(version.hashId)
                .pipe(
                  this.errorHandler.create({label: 'Get object version content'}),
                )
                .subscribe(content => {
                  version.contentValue = content;
                });
            }
          }
          if (this.changeCallback) {
            this.changeCallback(history.results.lastSelection);
          }
          if (this.touchCallback) {
            this.touchCallback();
          }
        });
        return history;
      }),
      this.errorHandler.create({label: 'Get object version history'}),
    ) : from([]);
  }

  goToPage(page: number) {
    this.page = page;
    this.refresh();
  }

  registerOnChange(fn): void {
    this.changeCallback = fn;
  }

  registerOnTouched(fn): void {
    this.touchCallback = fn;
  }

  writeValue(value): void {
    if (this._history) {
      if (value != null) {
        this._history.results.select(value);
      } else {
        this._history.results.select();
      }
    }
  }

}
