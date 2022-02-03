import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormArray } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

import { Subject } from 'rxjs';

import { FileNameAndSheets, SheetNameAndColumnNames } from 'app/interfaces';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { KgImportService } from 'app/kg-import/services/kg-import.service';
import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { UserFileImportService } from 'app/user-file-import/services/user-file-import.service';
import { ErrorResponse } from 'app/shared/schemas/common';

@Component({
    selector: 'app-gene-import',
    templateUrl: './gene-import-wizard.component.html',
    styleUrls: ['./gene-import-wizard.component.scss'],
    providers: [{
        provide: STEPPER_GLOBAL_OPTIONS, useValue: {displayDefaultIndicatorType: false}
    }]
})
export class GeneImportWizardComponent {
    loadingSheet: boolean;
    importingRelationships: boolean;

    worksheetData: FileNameAndSheets;

    importFileForm: FormGroup;
    sheetForm: FormGroup;

    geneConfigFormValid: boolean;
    geneConfigFormArray: FormArray;

    resetFileInputSubject: Subject<boolean>;

    readonly acceptedFileTypes = '.xlsx';

    get selectedSheet(): SheetNameAndColumnNames {
      return this.sheetForm.get('sheet').value;
    }

    constructor(
        private fb: FormBuilder,
        private userFileImportService: UserFileImportService,
        private kgImportService: KgImportService,
        private snackbar: MatSnackBar,
        private readonly messageDialog: MessageDialog,
    ) {
        this.loadingSheet = false;
        this.importingRelationships = false;

        this.worksheetData = null;

        this.importFileForm = this.fb.group({
            fileInput: ['', Validators.required],
        });

        this.sheetForm = this.fb.group({
            sheet: [null, Validators.required],
            worksheetNodeName: ['', Validators.required],
        });

        this.geneConfigFormValid = false;
        this.geneConfigFormArray =  null;

        this.resetFileInputSubject = new Subject<boolean>();
    }

    /**
     * Sets the file input form control, and retrieves the parsed file data from the backend.
     * @param file file input object
     */
    onFileChange(file: File) {
        this.importFileForm.get('fileInput').setValue(file);

        const formData = new FormData();
        formData.append('fileInput', this.importFileForm.value.fileInput);

        this.worksheetData = null;
        this.loadingSheet = true;
        this.userFileImportService.uploadExperimentalDataFile(formData).subscribe(
            result => {
                this.worksheetData = result;

                this.loadingSheet = false;
                this.snackbar.open('Finished loading worksheet!', 'Close', {duration: 3000});
            },
            (error: HttpErrorResponse) => {
                const message = (error.error as ErrorResponse).message;

                // Reset the fileInput for the purpose of detecting a file change (and having clean data). Otherwise,
                // if the user tries to re-select the file that failed to upload, no change will be detected.
                this.importFileForm.get('fileInput').setValue('');
                this.resetFileInputSubject.next(true);
                this.loadingSheet = false;
                this.messageDialog.display(
                    {
                        title: 'File Upload Error',
                        message,
                        type: MessageType.Error,
                    } as MessageArguments
                );
            }
        );
    }

    onSheetNameChange() {
       // Reset the gene config form objects whenever a new sheet is chosen. We can't do this in the
       // gene config component without triggering "Expression Changed After Checks" errors.
       this.geneConfigFormValid = false;
       this.geneConfigFormArray = null;
    }

    onRelationshipFormValidityChanged(valid: boolean) {
        this.geneConfigFormValid = valid;
    }

    onRelationshipsChanged(relationshipForms: FormGroup[]) {
        this.geneConfigFormArray = this.fb.array(relationshipForms);
    }

    importGeneRelationships() {
        const formData = new FormData();
        formData.append('fileName', this.worksheetData.filename);
        formData.append('sheetName', this.selectedSheet.sheetName);
        formData.append('fileInput', this.importFileForm.value.fileInput);
        formData.append('worksheetNodeName', this.sheetForm.get('worksheetNodeName').value);
        formData.append('relationships', JSON.stringify(this.geneConfigFormArray.getRawValue()));

        this.importingRelationships = true;
        // Need to use rawValue here to get the value of any disabled inputs (e.g.
        // the "nodeLabel2" input if KG Gene was selected for the column value).
        this.kgImportService.importGeneRelationships(formData).subscribe(
            result => {
                // TODO: Eventually we may do something with the result, which is a list
                // of relationships which didn't get matched to genes, if any.
                this.importingRelationships = false;
                this.snackbar.open('Finished importing relationships!', 'Close', {duration: 3000});
            },
            (error: HttpErrorResponse) => {
                const message = (error.error as ErrorResponse).message;

                this.importingRelationships = false;
                this.messageDialog.display(
                    {
                        title: 'Import Error',
                        message,
                        type: MessageType.Error,
                    } as MessageArguments
                );
            }
        );
    }
}
