import { HttpEventType } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BehaviorSubject, Observable, iif, of, merge } from 'rxjs';
import { filter, finalize, map, mergeMap, tap } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ResultMapping } from 'app/shared/schemas/common';
import { Progress, ProgressMode } from 'app/interfaces/common-dialog.interface';

import { PDFAnnotationGenerationRequest, ObjectCreateRequest, AnnotationGenerationResultData } from '../schema';
import { FilesystemObject } from '../models/filesystem-object';
import {
  ObjectEditDialogComponent,
  ObjectEditDialogValue,
} from '../components/dialog/object-edit-dialog.component';
import { AnnotationsService } from './annotations.service';
import { FilesystemService } from './filesystem.service';
import { ObjectReannotateResultsDialogComponent } from '../components/dialog/object-reannotate-results-dialog.component';

@Injectable()
export class ObjectCreationService {

  constructor(protected readonly annotationsService: AnnotationsService,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly progressDialog: ProgressDialog,
              protected readonly route: ActivatedRoute,
              protected readonly messageDialog: MessageDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly filesystemService: FilesystemService) {
  }

  /**
   * Handles the filesystem PUT request with a progress dialog.
   * @param request the request data
   * @param annotationOptions options for the annotation process
   * @return the created object
   */
  executePutWithProgressDialog(request: ObjectCreateRequest,
                               annotationOptions: PDFAnnotationGenerationRequest = {}):
    Observable<FilesystemObject> {
    const progressObservable = new BehaviorSubject<Progress>(new Progress({
      status: 'Preparing...',
    }));
    const progressDialogRef = this.progressDialog.display({
      title: `Creating '${request.filename}'`,
      progressObservable,
    });
    let results: [FilesystemObject[], ResultMapping<AnnotationGenerationResultData>[]] = null;

    return this.filesystemService.create(request)
      .pipe(
        tap(event => {
          // First we show progress for the upload itself
          if (event.type === HttpEventType.UploadProgress) {
            if (event.loaded === event.total && event.total) {
              progressObservable.next(new Progress({
                mode: ProgressMode.Indeterminate,
                status: 'File transmitted; saving...',
              }));
            } else {
              progressObservable.next(new Progress({
                mode: ProgressMode.Determinate,
                status: 'Transmitting file...',
                value: event.loaded / event.total,
              }));
            }
          }
        }),
        filter(event => event.bodyValue != null),
        map((event): FilesystemObject => event.bodyValue),
        mergeMap((object: FilesystemObject) => {
          // Then we show progress for the annotation generation (although
          // we can't actually show a progress percentage)
          progressObservable.next(new Progress({
            mode: ProgressMode.Indeterminate,
            status: 'Saved; Parsing and identifying annotations...',
          }));
          const annotationsService = this.annotationsService.generateAnnotations(
            [object.hashId], annotationOptions,
          ).pipe(map(result => {
            const check = Object.entries(result.mapping).map(r => r[1].success);
            if (check.some(c => c === false)) {
                results = [[object], [result]];
                const modalRef = this.modalService.open(ObjectReannotateResultsDialogComponent);
                modalRef.componentInstance.objects = results[0];
                modalRef.componentInstance.results = results[1];
            }
            return object;
          }));
          return iif(
            () => object.isAnnotatable,
            merge(annotationsService),
            of(object)
          );
        }),
        finalize(() => {
          progressDialogRef.close();
        }),
        this.errorHandler.create({label: 'Create object'}),
      );
  }

  /**
   * Open a dialog to create a new file or folder.
   * @param target the base object to start from
   * @param options options for the dialog
   */
  openCreateDialog(target: FilesystemObject,
                   options: CreateDialogOptions = {}): Promise<FilesystemObject> {
    const dialogRef = this.modalService.open(ObjectEditDialogComponent);
    dialogRef.componentInstance.title = options.title || 'New File';
    dialogRef.componentInstance.object = target;
    const keys: Array<keyof CreateDialogOptions> = [
      'promptUpload',
      'forceAnnotationOptions',
      'promptParent',
      'parentLabel',
    ];
    for (const key of keys) {
      if (key in options) {
        dialogRef.componentInstance[key] = options[key];
      }
    }
    dialogRef.componentInstance.accept = ((value: ObjectEditDialogValue) => {
      return this.executePutWithProgressDialog({
        ...value.request,
        ...(options.request || {}),
        // NOTE: Due to the cast to ObjectCreateRequest, we do not guarantee,
        // via the type checker, that we will be forming a 100% legitimate request,
        // because it's possible to provide multiple sources of content due to this cast, which
        // the server will reject because it does not make sense
      } as ObjectCreateRequest, {
        annotationConfigs: value.annotationConfigs,
        organism: value.organism,
      }).toPromise();
    });
    return dialogRef.result;
  }

}

export interface CreateDialogOptions {
  title?: string;
  promptUpload?: boolean;
  forceAnnotationOptions?: boolean;
  promptParent?: boolean;
  parentLabel?: string;
  request?: Partial<ObjectCreateRequest>;
}
