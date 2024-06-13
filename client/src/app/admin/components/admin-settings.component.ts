import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

import { BehaviorSubject, throwError, zip, of, EMPTY } from 'rxjs';
import { concatMap, mergeMap, catchError, delay } from 'rxjs/operators';

import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { StorageService } from 'app/shared/services/storage.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
// TODO: Deprecate after LL-2840
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { EnrichmentTableService } from 'app/enrichment/services/enrichment-table.service';
import { EnrichmentDocument } from 'app/enrichment/models/enrichment-document';
import { getProgressStatus } from 'app/shared/components/dialog/progress-dialog.component';

@Component({
    selector: 'app-admin-settings-view',
    templateUrl: 'admin-settings.component.html',
})
export class AdminSettingsComponent {

    readonly form: FormGroup = new FormGroup({
        files: new FormControl(''),
    });

    constructor(
        private readonly progressDialog: ProgressDialog,
        private readonly errorHandler: ErrorHandler,
        private readonly snackBar: MatSnackBar,
        private storage: StorageService,
        private filesystemService: FilesystemService,
        private worksheetViewerService: EnrichmentTableService,
    ) {}

    fileChanged(event) {
        if (event.target.files.length) {
            const file = event.target.files[0];
            this.form.get('files').setValue([file]);
        } else {
            this.form.get('files').setValue(null);
        }
    }

    // TODO: Deprecate after LL-2840
    updateEnrichment() {
      this.filesystemService
        .getAllEnrichmentTables()
        .pipe(
          mergeMap((hashId) => hashId, 5),
          concatMap((hashId) =>
            zip(
              of(hashId),
              this.filesystemService.getContent(hashId).pipe(
                delay(1000),
                catchError((err) => {
                  console.log(err);
                  return EMPTY;
                })
              )
            )
          ),
          concatMap(([hashId, blob]) =>
            zip(
              of(hashId),
              new EnrichmentDocument(this.worksheetViewerService).loadResult(blob, hashId).pipe(
                delay(1000),
                catchError((err) => {
                  console.log(err);
                  return EMPTY;
                })
              )
            )
          ),
          concatMap(([hashId, document]) =>
            zip(
              of(document),
              of(hashId),
              document.updateParameters().pipe(
                delay(1000),
                catchError((err) => {
                  console.log(err);
                  return EMPTY;
                })
              )
            )
          ),
          concatMap(([document, hashId, newBlob]) =>
            this.filesystemService
              .save([hashId], {
                contentValue: newBlob,
                fallbackOrganism: {
                  organism_name: document.organism,
                  synonym: document.organism,
                  tax_id: document.taxID,
                },
              })
              .pipe(
                delay(1000),
                catchError((err) => {
                  console.log(err);
                  return EMPTY;
                })
              )
          ),
        )
        .subscribe(
          (x) => console.log(`Updated enrichment table: ${x}`),
          (err) => console.log(err)
        );
    }

    submit() {
        const progressObservables = [new BehaviorSubject<Progress>(new Progress({
            status: 'Uploading user manual...',
        }))];
        const progressDialogRef = this.progressDialog.display({
            title: 'Saving manual as lifelike-user-manual.pdf...',
            progressObservables,
        });
        const data = {...this.form.value};
        const file: File = data.files[0];
        this.storage
          .uploadUserManual(file)
          .pipe(this.errorHandler.create({label: 'Upload user manual'}))
          .subscribe(
            (event) => {
              if (event.type === HttpEventType.UploadProgress) {
                progressObservables[0].next(
                  getProgressStatus(event, 'Processing file...', 'Uploading file...')
                );
              } else if (event.type === HttpEventType.Response) {
                progressDialogRef.close();
                this.snackBar.open(`User manual uploaded`, 'Close', {
                  duration: 5000,
                });
              }
            },
            (err) => {
              progressDialogRef.close();
              return throwError(err);
            }
          );
    }
}
