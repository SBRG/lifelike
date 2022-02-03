import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';

import { Store, select } from '@ngrx/store';
import { Observable } from 'rxjs';

import {
    SheetNameAndColumnNames,
    Neo4jNodeMapping,
    NodeMappingHelper,
} from 'app/interfaces/user-file-import.interface';
import { State } from 'app/root-store';

import { UserFileImportSelectors as selectors } from '../store';
import { saveNodeMapping } from '../store/actions';

@Component({
    selector: 'app-user-file-import-column-mapping',
    templateUrl: 'user-file-import-column-mapping.component.html',
    styles: [
        '.mat-cell { margin: 0 10px 0 10px; }',
        '.mat-header-cell { margin: 0 10px 0 10px; }',
    ],
})
export class UserFileImportColumnMappingComponent {
    @Input() chosenSheetToMap: SheetNameAndColumnNames;
    @Input() columnsForFilePreview: string[];
    @Input() columnDelimiterForm: FormGroup;

    @Output() nextStep: EventEmitter<boolean>;

    dbNodeTypes$: Observable<string[]>;
    dbNodeProperties$: Observable<{[key: string]: string[]}>;
    dbRelationshipTypes$: Observable<string[]>;

    columnMappingForm: FormGroup;
    nodePropertyMappingForm: FormGroup;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        this.dbNodeTypes$ = this.store.pipe(select(selectors.selectDbLabels));
        this.dbNodeProperties$ = this.store.pipe(select(selectors.selectNodeProperties));
        this.dbRelationshipTypes$ = this.store.pipe(select(selectors.selectDbRelationshipTypes));

        this.columnMappingForm = this.fb.group({
            // newColumnMapping is creating a new mapping to the knowledge graph
            newColumnMapping: this.fb.array([]),
            // existingColumnMapping is identifying any column that already had a mapping created/uploaded previously
            existingColumnMapping: this.fb.array([]),
        });
        this.nodePropertyMappingForm = this.fb.group({nodePropertyMapping: this.fb.array([])});
        this.nextStep = new EventEmitter();
    }

    addNewColumnMappingRow() {
        const form = this.columnMappingForm.get('newColumnMapping') as FormArray;
        const row = this.fb.group({
            domain: [],
            columnNode: [],
            newNodeLabel: [],
            mappedNodeLabel: [],
            mappedNodeProperty: [],
            edge: [],
        });
        form.push(row);
    }

    addExistingColumnMappingRow() {
        const form = this.columnMappingForm.get('existingColumnMapping') as FormArray;
        const row = this.fb.group({
            columnNode: [],
            mappedNodeLabel: [],
            mappedNodeProperty: [],
        });
        form.push(row);
    }

    addNodePropertyMappingRow() {
        const form = this.nodePropertyMappingForm.get('nodePropertyMapping') as FormArray;
        const row = this.fb.group({
            columnNode: [],
            nodeProperty: [],
            unique: [],
        });
        form.push(row);
    }

    deleteNewColumnMappingRow(idx) {
        (this.columnMappingForm.get('newColumnMapping') as FormArray).removeAt(idx);
    }

    deleteExistingColumnMappingRow(idx) {
        (this.columnMappingForm.get('existingColumnMapping') as FormArray).removeAt(idx);
    }

    deleteColumnNodePropertyMappingRow(idx) {
        (this.nodePropertyMappingForm.get('nodePropertyMapping') as FormArray).removeAt(idx);
    }

    createNodeMappings() {
        /**
         * first create mapping for new nodes to be created
         */
        const nodeMapping = {
            mapping: {
                existingMappings: {},
                newMappings: {},
                delimiters: {},
            }
        } as NodeMappingHelper;

        /**
         * create the column delimiters
         */
        const columnDelimitersFormArray = this.columnDelimiterForm.get('columnDelimiters') as FormArray;
        columnDelimitersFormArray.controls.forEach((group: FormGroup) => {
            const propMappingKey = Object.values(group.controls.column.value)[0] as number;
            nodeMapping.mapping.delimiters[propMappingKey] = group.controls.delimiter.value;
        });

        let columnMappingFormArray = this.columnMappingForm.get('newColumnMapping') as FormArray;

        columnMappingFormArray.controls.forEach((group: FormGroup) => {
            // flip so {[key: number]: string}
            const propMappingKey = Object.values(group.controls.columnNode.value)[0] as number;
            const propMappingValue = Object.keys(group.controls.columnNode.value)[0];
            const propMapping = {[propMappingKey]: propMappingValue};
            nodeMapping.mapping.newMappings[propMappingKey] = {
                domain: group.controls.domain.value,
                nodeType: group.controls.newNodeLabel.value,
                nodeProperties: null,
                mappedNodeType: group.controls.mappedNodeLabel.value,
                mappedNodePropertyFrom: propMapping,
                mappedNodePropertyTo: group.controls.mappedNodeProperty.value,
                edge: group.controls.edge.value,
                uniqueProperty: '',
            } as Neo4jNodeMapping;
        });

        const nodePropertyMappingFormArray = this.nodePropertyMappingForm.get('nodePropertyMapping') as FormArray;

        nodePropertyMappingFormArray.controls.forEach((group: FormGroup) => {
            const existingProps = nodeMapping.mapping.newMappings[
                Object.values(group.controls.columnNode.value)[0] as number
            ].nodeProperties;

            // flip so {[key: number]: string}
            const propMappingKey = Object.values(group.controls.nodeProperty.value)[0] as number;
            const propMappingValue = Object.keys(group.controls.nodeProperty.value)[0];
            const propMapping = {[propMappingKey]: propMappingValue};

            nodeMapping.mapping.newMappings[
                Object.values(group.controls.columnNode.value)[0] as number
            ].nodeProperties = {...existingProps, ...propMapping};

            if (group.controls.unique.value) {
                nodeMapping.mapping.newMappings[
                    Object.values(group.controls.columnNode.value)[0] as number
                ].uniqueProperty = group.controls.unique.value;
            }
        });

        /**
         * now create mappings for any that were previously created/uploaded
         */
        columnMappingFormArray = this.columnMappingForm.get('existingColumnMapping') as FormArray;

        columnMappingFormArray.controls.forEach((group: FormGroup) => {
            // flip so {[key: number]: string}
            const propMappingKey = Object.values(group.controls.columnNode.value)[0] as number;
            const propMappingValue = Object.keys(group.controls.columnNode.value)[0];
            const propMapping = {[propMappingKey]: propMappingValue};
            nodeMapping.mapping.existingMappings[propMappingKey] = {
                mappedNodeType: group.controls.mappedNodeLabel.value || '',
                mappedNodePropertyFrom: propMapping,
                mappedNodePropertyTo: group.controls.mappedNodeProperty.value || '',
            } as Neo4jNodeMapping;
        });

        this.store.dispatch(saveNodeMapping({payload: nodeMapping}));
        this.nextStep.emit(true);
    }
}
