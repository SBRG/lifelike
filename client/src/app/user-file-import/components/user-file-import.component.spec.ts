import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
} from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { FormArray } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MemoizedSelector, Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';
import {
    FileNameAndSheets,
    NodeMappingHelper,
    SheetNameAndColumnNames,
    SheetRowPreview,
} from 'app/interfaces';

import {
    UserFileImportState as userFileImportState,
    UserFileImportSelectors as selectors,
} from '../store';
import { uploadExperimentalDataFile } from '../store/actions';
import { UserFileImportComponent } from './user-file-import.component';

describe('UserFileImportComponent', () => {
    let component: UserFileImportComponent;
    let fixture: ComponentFixture<UserFileImportComponent>;
    let mockStore: MockStore<userFileImportState.State>;
    let mockFileNameAndSheetSelector: MemoizedSelector<userFileImportState.State, FileNameAndSheets>;
    let mockNodeMappingHelperSelector: MemoizedSelector<userFileImportState.State, NodeMappingHelper>;
    let overlayContainerElement: HTMLElement;

    let mockFileNameAndSheets;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            providers: [
                provideMockStore(),
                {
                    provide: OverlayContainer, useFactory: () => {
                    overlayContainerElement = document.createElement('div');
                    return { getContainerElement: () => overlayContainerElement };
                }},
            ],
            imports: [
                RootStoreModule,
                SharedModule,
                BrowserAnimationsModule
            ],
        })
        .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(UserFileImportComponent);
        component = fixture.componentInstance;

        mockFileNameAndSheets = {
            filename: 'test_file.xlsx',
            sheets: [
                {
                    sheetColumnNames: [{colA: 0}, {colB: 1}],
                    sheetName: 'sheet1',
                    sheetPreview: [
                        {colA: 'colA'},
                        {colB: 'colB'},
                    ] as SheetRowPreview[],
                } as SheetNameAndColumnNames,
            ] as SheetNameAndColumnNames[],
        } as FileNameAndSheets;

        mockStore = TestBed.get(Store);
        mockFileNameAndSheetSelector = mockStore.overrideSelector(
            selectors.selectFileNameAndSheets, mockFileNameAndSheets);
        mockNodeMappingHelperSelector = mockStore.overrideSelector(
            selectors.selectNodeMappingHelper, null);

        spyOn(mockStore, 'dispatch').and.callThrough();
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeDefined();
    });

    it('should display sheet names in dropdown', fakeAsync(() => {
        const select: HTMLElement = fixture.debugElement.query(
            By.css('#sheetname-dropdown .mat-select-trigger')).nativeElement;

        select.click();
        // used within fakeAsync to simulate
        // time passing, e.g setInterval(), etc...
        flush();
        fixture.detectChanges();

        const option: HTMLElement = overlayContainerElement.querySelector('mat-option');

        expect(option.innerText).toEqual(
            mockFileNameAndSheets.sheets[0].sheetName);
    }));

    it('should dispatch uploadExperimentalDataFile action', () => {
        const testFile = new File([new Blob()], 'test file');
        component.fileForm.controls.fileInput.setValue(testFile);

        const formData = new FormData();
        formData.append('fileInput', testFile);
        const action = uploadExperimentalDataFile({payload: formData});
        component.uploadFile();

        expect(mockStore.dispatch).toHaveBeenCalledWith(action);
    });

    it('should add column delimiter form row', () => {
        component.addColumnDelimiterRow();
        expect(
            (component.columnDelimiterForm.get('columnDelimiters') as FormArray).controls.length,
        ).toEqual(1);
    });

    it('should remove column delimiter form row', () => {
        component.addColumnDelimiterRow();
        component.deleteColumnDelimiterRow(0);
        expect(
            (component.columnDelimiterForm.get('columnDelimiters') as FormArray).controls.length,
        ).toEqual(0);
    });

    it('should add file from input to file form', () => {
        const input: HTMLElement = fixture.debugElement.query(By.css('#file-upload-btn')).nativeElement;

        spyOn(component, 'onFileChange');
        // TODO: maybe figure out how to add to event.target?
        // it's readonly in MDN docs
        input.dispatchEvent(new Event('change'));
        expect(component.onFileChange).toHaveBeenCalled();
    });
});
