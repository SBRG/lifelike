import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flush,
} from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { FormBuilder } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';
import { By } from '@angular/platform-browser';
import { DebugElement } from '@angular/core';
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
import { UserFileImportColumnRelationshipMappingRowComponent } from './user-file-import-column-relationship-mapping-row.component';

describe('UserFileImportColumnRelationshipMappingRowComponent', () => {
    let component: UserFileImportColumnRelationshipMappingRowComponent;
    let fixture: ComponentFixture<UserFileImportColumnRelationshipMappingRowComponent>;
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
        fixture = TestBed.createComponent(UserFileImportColumnRelationshipMappingRowComponent);
        component = fixture.componentInstance;
        fb = new FormBuilder();

        columnHeaders = [{colA: 1}];
        existingNodeLabels = ['labelA', 'labelB'];
        existingNodeProperties = {labelA: ['propA', 'propB']};

        component.relationshipMappingForm = fb.group({
            edge: [],
            source: [],
            target: [],
            mappedNodeType: [],
            mappedNodeProperty: [],
        });
        component.columnHeaders = columnHeaders;
        component.dbNodeTypes = existingNodeLabels;
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
            By.css('#relationship-mapping-select-existing-node-type-dropdown')
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
            By.css('#relationship-mapping-select-column-header-dropdown .mat-select-trigger')
        ).nativeElement;

        select.click();
        flush();
        fixture.detectChanges();

        const option: NodeListOf<HTMLElement> = overlayContainerElement.querySelectorAll('mat-option');

        expect(option[0].innerText).toEqual(Object.keys(columnHeaders[0])[0]);
    }));

    it('should display existing node labels', fakeAsync(() => {
        const select: HTMLElement = fixture.debugElement.query(
            By.css('#relationship-mapping-select-existing-node-type-dropdown .mat-select-trigger')
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
        component.relationshipMappingForm.controls.mappedNodeType.setValue('labelA');
        fixture.detectChanges();

        const select: HTMLElement = fixture.debugElement.query(
            By.css('#relationship-mapping-select-existing-node-properties-dropdown .mat-select-trigger')
        ).nativeElement;

        select.click();
        flush();
        fixture.detectChanges();

        const option: NodeListOf<HTMLElement> = overlayContainerElement.querySelectorAll('mat-option');

        expect(option[0].innerText).toEqual(existingNodeProperties.labelA[0]);
        expect(option[1].innerText).toEqual(existingNodeProperties.labelA[1]);
    }));

    // TODO: disabled keeps coming back as undefined
    xit('should disable relationship dropdown if input is used', fakeAsync(() => {
        const select: DebugElement = fixture.debugElement.query(
            By.css('#relationship-mapping-select-relationship-dropdown')
        );

        component.newRelationshipInput.nativeElement.value = 'new relationship';
        component.relationshipInputChange();

        flush();
        fixture.detectChanges();

        expect(select.nativeElement.disabled).toBe(true);
    }));
});
