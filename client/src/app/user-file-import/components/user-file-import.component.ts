import { Component, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';
import { MatStepper } from '@angular/material/stepper';

import { Store, select } from '@ngrx/store';
import { Observable, Subscription } from 'rxjs';

import { State } from 'app/root-store';
import {
    FileNameAndSheets,
    SheetNameAndColumnNames,
    NodeMappingHelper,
} from 'app/interfaces/user-file-import.interface';

import { UserFileImportSelectors as selectors } from '../store';
import {
    uploadExperimentalDataFile,
    getDbLabels,
    getDbRelationshipTypes,
} from '../store/actions';

@Component({
    selector: 'app-user-file-import',
    templateUrl: 'user-file-import.component.html',
    styleUrls: ['user-file-import.component.scss'],
})
export class UserFileImportComponent implements OnInit, OnDestroy {
    @ViewChild('fileInput', { static: true }) fileInput: ElementRef;
    @ViewChild(MatStepper, { static: true }) stepper: MatStepper;

    chosenSheetToMap: SheetNameAndColumnNames;

    fileName: string;
    relationshipFile: boolean;
    columnsForFilePreview: string[];

    fileForm: FormGroup;
    columnDelimiterForm: FormGroup;

    fileNameAndSheets$: Observable<FileNameAndSheets>;
    fileNameAndSheetsSub: Subscription;
    nodeMappingHelper$: Observable<NodeMappingHelper>;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        this.fileNameAndSheets$ = this.store.pipe(select(selectors.selectFileNameAndSheets));
        this.nodeMappingHelper$ = this.store.pipe(select(selectors.selectNodeMappingHelper));

        this.fileName = null;
        this.relationshipFile = false;
        this.columnsForFilePreview = [];

        this.fileForm = this.fb.group({
            fileInput: null,
            crossRef: [false],
        });
        this.columnDelimiterForm = this.fb.group({columnDelimiters: this.fb.array([])});
    }

    ngOnInit() {
        this.fileNameAndSheetsSub = this.fileNameAndSheets$.subscribe(data => {
            // navigate to step 2 Select sheet
            // once server returns parsed data
            if (data) {
                this.stepper.next();
            }
        });
    }

    ngOnDestroy() {
        this.fileNameAndSheetsSub.unsubscribe();
    }

    onFileChange(event) {
        const file = event.target.files[0];
        this.fileName = file.name;
        this.fileForm.controls.fileInput.setValue(file);
    }

    clearFilesField() {
        this.fileName = null;
        this.fileInput.nativeElement.value = '';
    }

    uploadFile() {
        const formData = new FormData();
        formData.append('fileInput', this.fileForm.controls.fileInput.value);
        this.store.dispatch(uploadExperimentalDataFile({payload: formData}));
    }

    addColumnDelimiterRow() {
        const form = this.columnDelimiterForm.get('columnDelimiters') as FormArray;
        const row = this.fb.group({
            column: [],
            delimiter: [],
        });
        form.push(row);
    }

    deleteColumnDelimiterRow(idx) {
        (this.columnDelimiterForm.get('columnDelimiters') as FormArray).removeAt(idx);
    }

    goToMapColumns() {
        this.chosenSheetToMap.sheetColumnNames.forEach(column => {
            this.columnsForFilePreview.push(Object.keys(column)[0]);
        });
        this.store.dispatch(getDbRelationshipTypes());
        this.store.dispatch(getDbLabels());
        this.stepper.next();
    }

    goToMapRelationships() {
        this.stepper.next();
    }
}
