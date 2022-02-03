import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
} from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { FormBuilder } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';
import { By, BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import {
    UserFileImportState as userFileImportState,
} from '../store';
import { getNodeProperties } from '../store/actions';
import { UserFileImportExistingColumnMappingRowComponent } from './user-file-import-existing-column-mapping-row.component';

describe('UserFileImportExistingColumnMappingRowComponent', () => {
    let component: UserFileImportExistingColumnMappingRowComponent;
    let fixture: ComponentFixture<UserFileImportExistingColumnMappingRowComponent>;
    let mockStore: MockStore<userFileImportState.State>;
    let overlayContainerElement: HTMLElement;
    let fb: FormBuilder;

    let columnHeaders;
    let existingNodeLabels;
    let existingNodeProperties;

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
        fixture = TestBed.createComponent(UserFileImportExistingColumnMappingRowComponent);
        component = fixture.componentInstance;
        fb = new FormBuilder();

        columnHeaders = [{colA: 1}];
        existingNodeLabels = ['labelA', 'labelB'];
        existingNodeProperties = {labelA: ['propA', 'propB']};

        component.columnMappingForm = fb.group({
            columnNode: [],
            mappedNodeLabel: [],
            mappedNodeProperty: [],
        });
        component.columnHeaders = columnHeaders;
        component.existingNodeLabels = existingNodeLabels;
        component.existingNodeProperties = existingNodeProperties;

        mockStore = TestBed.get(Store);

        spyOn(mockStore, 'dispatch').and.callThrough();
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeDefined();
    });

    it('should call selectExistingNodeType() on event', () => {
        const select: HTMLElement = fixture.debugElement.query(
            By.css('#existing-column-mapping-select-existing-node-type-dropdown')
        ).nativeElement;

        spyOn(component, 'selectExistingNodeType');
        select.dispatchEvent(new Event('selectionChange'));
        expect(component.selectExistingNodeType).toHaveBeenCalled();
    });

    it('should dispatch getNodeProperties action', () => {
        const event: MatSelectChange = {value: 'labelA', source: null};
        const action = getNodeProperties({payload: event.value});
        component.selectExistingNodeType(event);
        expect(mockStore.dispatch).toHaveBeenCalledWith(action);
    });

    it('should display column headers', fakeAsync(() => {
        const select: HTMLElement = fixture.debugElement.query(
            By.css('#existing-column-mapping-select-column-header-dropdown .mat-select-trigger')
        ).nativeElement;

        select.click();
        flush();
        fixture.detectChanges();

        const option: NodeListOf<HTMLElement> = overlayContainerElement.querySelectorAll('mat-option');

        expect(option[0].innerText).toEqual(Object.keys(columnHeaders[0])[0]);
    }));

    it('should display existing node labels', fakeAsync(() => {
        const select: HTMLElement = fixture.debugElement.query(
            By.css('#existing-column-mapping-select-existing-node-type-dropdown .mat-select-trigger')
        ).nativeElement;

        select.click();
        flush();
        fixture.detectChanges();

        const option: NodeListOf<HTMLElement> = overlayContainerElement.querySelectorAll('mat-option');

        expect(option[0].innerText).toEqual(existingNodeLabels[0]);
        expect(option[1].innerText).toEqual(existingNodeLabels[1]);
    }));

    it('should display existing node properties labels', fakeAsync(() => {
        // simulate choosing labelA
        component.columnMappingForm.controls.mappedNodeLabel.setValue('labelA');
        fixture.detectChanges();

        const select: HTMLElement = fixture.debugElement.query(
            By.css('#existing-column-mapping-select-existing-node-properties-dropdown .mat-select-trigger')
        ).nativeElement;

        select.click();
        flush();
        fixture.detectChanges();

        const option: NodeListOf<HTMLElement> = overlayContainerElement.querySelectorAll('mat-option');

        expect(option[0].innerText).toEqual(existingNodeProperties.labelA[0]);
        expect(option[1].innerText).toEqual(existingNodeProperties.labelA[1]);
    }));
});
