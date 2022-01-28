import { Component, Input } from '@angular/core';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { ResultMapping } from 'app/shared/schemas/common';

import { FilesystemObject } from '../../models/filesystem-object';
import {AnnotationGenerationResultData } from '../../schema';

@Component({
  selector: 'app-object-reannotate-results-dialog',
  templateUrl: './object-reannotate-results-dialog.component.html',
})
export class ObjectReannotateResultsDialogComponent extends ConfirmDialogComponent {
  @Input() objects: FilesystemObject[] = [];

  _results: ResultMapping<AnnotationGenerationResultData>[] = [];

  success: string[] = [];
  failed: object[] = [];
  // TODO: show missing files?

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
  }

  get results() { return this._results; }

  @Input()
  set results(values: ResultMapping<AnnotationGenerationResultData>[]) {
    const all = {};
    for (const value of values) {
      for (const [hashId, status] of Object.entries(value.mapping)) {
        all[hashId] = status;
      }
    }

    for (const f of this.objects) {
      let result = null;
      if (all.hasOwnProperty(f.hashId)) {
        result = all[f.hashId] as AnnotationGenerationResultData;
      }
      if (result !== null) {
        if (result.success) {
          this.success.push(f.filename);
        } else {
          this.failed.push({filename: f.filename, error: result.error});
        }
      }
    }
  }
}
