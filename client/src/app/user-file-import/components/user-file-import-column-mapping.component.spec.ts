import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';
import { FormBuilder, FormArray } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MemoizedSelector, Store } from '@ngrx/store';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';
import {
    ColumnNameIndex,
    Neo4jNodeMapping,
    NodeMappingHelper,
    SheetNameAndColumnNames,
    SheetRowPreview,
} from 'app/interfaces';

import {
    UserFileImportState as userFileImportState,
    UserFileImportSelectors as selectors,
} from '../store';
import { saveNodeMapping } from '../store/actions';
import { UserFileImportColumnMappingComponent } from './user-file-import-column-mapping.component';

const chosenSheetToMap = {
    sheetName: 'sheet1',
    sheetColumnNames: [
        {colA: 0},
        {colB: 1}
    ] as ColumnNameIndex[],
    sheetPreview: [
        {colA: 'value1', colB: 'value2'},
    ] as SheetRowPreview[],
} as SheetNameAndColumnNames;

describe('UserFileImportColumnMappingComponent', () => {
    let component: UserFileImportColumnMappingComponent;
    let fixture: ComponentFixture<UserFileImportColumnMappingComponent>;
    let mockStore: MockStore<userFileImportState.State>;
    let fb: FormBuilder;

    let dbNodeTypesSelector: MemoizedSelector<userFileImportState.State, string[]>;
    let dbNodePropertiesSelector: MemoizedSelector<userFileImportState.State, { [key: string]: string[] }>;
    let dbRelationshipTypesSelector: MemoizedSelector<userFileImportState.State, string[]>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            providers: [
                provideMockStore(),
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
        fixture = TestBed.createComponent(UserFileImportColumnMappingComponent);
        component = fixture.componentInstance;
        fb = new FormBuilder();

        const columnsForFilePreview = ['colA', 'colB'];

        // mock store
        const mockDbNodeTypes = ['labelA', 'labelB'];
        const mockNodeProperties = {labelA: ['propA', 'propB']};
        const mockRelationshipTypes = ['IS_A'];

        component.columnDelimiterForm = fb.group({
            columnDelimiters: fb.array([]),
        });
        component.chosenSheetToMap = chosenSheetToMap;
        component.columnsForFilePreview = columnsForFilePreview;

        mockStore = TestBed.get(Store);

        dbNodeTypesSelector = mockStore.overrideSelector(
            selectors.selectDbLabels, mockDbNodeTypes);
        dbNodePropertiesSelector = mockStore.overrideSelector(
            selectors.selectNodeProperties, mockNodeProperties);
        dbRelationshipTypesSelector = mockStore.overrideSelector(
            selectors.selectDbRelationshipTypes, mockRelationshipTypes);

        spyOn(mockStore, 'dispatch').and.callThrough();
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeDefined();
    });

    it('should add new column mapping form row', () => {
        component.addNewColumnMappingRow();
        expect(
            (component.columnMappingForm.get('newColumnMapping') as FormArray).controls.length,
        ).toEqual(1);
    });

    it('should add existing column mapping form row', () => {
        component.addExistingColumnMappingRow();
        expect(
            (component.columnMappingForm.get('existingColumnMapping') as FormArray).controls.length,
        ).toEqual(1);
    });

    it('should add node property mapping form row', () => {
        component.addNodePropertyMappingRow();
        expect(
            (component.nodePropertyMappingForm.get('nodePropertyMapping') as FormArray).controls.length,
        ).toEqual(1);
    });

    it('should remove new column mapping form row', () => {
        component.addNewColumnMappingRow();
        component.deleteNewColumnMappingRow(0);
        expect(
            (component.columnMappingForm.get('newColumnMapping') as FormArray).controls.length,
        ).toEqual(0);
    });

    it('should remove existing column mapping form row', () => {
        component.addExistingColumnMappingRow();
        component.deleteExistingColumnMappingRow(0);
        expect(
            (component.columnMappingForm.get('existingColumnMapping') as FormArray).controls.length,
        ).toEqual(0);
    });

    it('should remove node property mapping form row', () => {
        component.addNodePropertyMappingRow();
        component.deleteColumnNodePropertyMappingRow(0);
        expect(
            (component.nodePropertyMappingForm.get('nodePropertyMapping') as FormArray).controls.length,
        ).toEqual(0);
    });

    it('should create a node mapping helper', () => {
        component.addNewColumnMappingRow();
        const form1 = component.columnMappingForm.get('newColumnMapping') as FormArray;
        form1.controls[0].patchValue({domain: 'Domain A'});
        form1.controls[0].patchValue({columnNode: {id: 0}});
        form1.controls[0].patchValue({newNodeLabel: 'LabelA'});
        form1.controls[0].patchValue({mappedNodeLabel: 'LabelB'});
        form1.controls[0].patchValue({mappedNodeProperty: 'propA'});
        form1.controls[0].patchValue({edge: 'IS_A'});

        component.addNodePropertyMappingRow();
        const form2 = component.nodePropertyMappingForm.get('nodePropertyMapping') as FormArray;
        form2.controls[0].patchValue({columnNode: {ColA: 0}});
        form2.controls[0].patchValue({nodeProperty: {ColB: 1}});

        const nodeMapper = {
            mapping: {
                existingMappings: {},
                newMappings: {
                    0: {
                        domain: 'Domain A',
                        nodeType: 'LabelA',
                        nodeProperties: {
                            1: 'ColB',
                        },
                        mappedNodeType: 'LabelB',
                        mappedNodePropertyFrom: {0: 'id'},
                        mappedNodePropertyTo: 'propA',
                        edge: 'IS_A',
                        uniqueProperty: '',
                    } as Neo4jNodeMapping,
                },
                delimiters: {},
            },
        } as NodeMappingHelper;

        const action = saveNodeMapping({payload: nodeMapper});
        component.createNodeMappings();
        expect(mockStore.dispatch).toHaveBeenCalledWith(action);
    });
});
