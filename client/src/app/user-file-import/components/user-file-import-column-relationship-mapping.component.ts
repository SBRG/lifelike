import { Component, Input } from '@angular/core';
import { FormGroup, FormBuilder, FormArray } from '@angular/forms';

import { Observable } from 'rxjs';
import { Store, select } from '@ngrx/store';

import {
    SheetNameAndColumnNames,
    Neo4jRelationshipMapping,
    NodeMappingHelper,
    Neo4jColumnMapping,
} from 'app/interfaces/user-file-import.interface';
import { State } from 'app/root-store';

import { UserFileImportSelectors as selectors } from '../store';
import { uploadNodeMapping } from '../store/actions';

@Component({
    selector: 'app-user-file-import-column-relationship-mapping',
    templateUrl: 'user-file-import-column-relationship-mapping.component.html',
    styles: [
        '.mat-cell { margin: 0 10px 0 10px; }',
        '.mat-header-cell { margin: 0 10px 0 10px; }',
    ],
})
export class UserFileImportColumnRelationshipMapperComponent {
    @Input() chosenSheetToMap: SheetNameAndColumnNames;
    @Input() fileName: string;
    @Input() nodeMappingHelper: NodeMappingHelper;
    @Input() columnsForFilePreview: string[];

    relationshipMappingForm: FormGroup;

    dbNodeTypes$: Observable<string[]>;
    dbNodeProperties$: Observable<{[key: string]: string[]}>;

    constructor(
        private fb: FormBuilder,
        private store: Store<State>,
    ) {
        this.dbNodeTypes$ = this.store.pipe(select(selectors.selectDbLabels));
        this.dbNodeProperties$ = this.store.pipe(select(selectors.selectNodeProperties));
        this.relationshipMappingForm = this.fb.group({relationshipMapping: this.fb.array([])});
    }

    addRelationshipMappingRow() {
        const form = this.relationshipMappingForm.get('relationshipMapping') as FormArray;
        const row = this.fb.group({
            edge: [],
            source: [],
            target: [],
            mappedNodeType: [],
            mappedNodeProperty: [],
        });
        form.push(row);
    }

    deleteRelationshipMappingRow(idx) {
        (this.relationshipMappingForm.get('relationshipMapping') as FormArray).removeAt(idx);
    }

    createRelationshipMapping() {
        const mappings = {
            newNodes: {},
            existingNodes: {},
        } as Neo4jColumnMapping;

        const relationshipMapper = [];
        const relationshipMappingFormArray = this.relationshipMappingForm.get('relationshipMapping') as FormArray;

        if (relationshipMappingFormArray) {
            relationshipMappingFormArray.controls.forEach((group: FormGroup) => {
                const currentRelationship = {} as Neo4jRelationshipMapping;
                // TODO: handle user input for new edges
                // set key to negative number in that case
                // so backend can know when to just create a new edge

                if (typeof group.controls.edge.value === 'string') {
                    const edgeKey = -1;
                    currentRelationship.edge = {[edgeKey]: group.controls.edge.value};
                } else {
                    // flip so {[key: number]: string}
                    const edgeKey = Object.values(group.controls.edge.value)[0] as number;
                    const edgeValue = Object.keys(group.controls.edge.value)[0];
                    currentRelationship.edge = {[edgeKey]: edgeValue};
                }

                const sourceIdxKey = Object.values(group.controls.source.value)[0] as number;
                const targetIdxKey = Object.values(group.controls.target.value)[0] as number;

                if (sourceIdxKey in this.nodeMappingHelper.mapping.existingMappings) {
                    currentRelationship.sourceNode = this.nodeMappingHelper.mapping.existingMappings[sourceIdxKey];
                } else if (sourceIdxKey in this.nodeMappingHelper.mapping.newMappings) {
                    currentRelationship.sourceNode = this.nodeMappingHelper.mapping.newMappings[sourceIdxKey];
                } else {
                    // TODO: handle error here
                    // if no index mapping then something happened and no node was associated
                }

                if (targetIdxKey in this.nodeMappingHelper.mapping.existingMappings) {
                    currentRelationship.targetNode = this.nodeMappingHelper.mapping.existingMappings[targetIdxKey];
                } else if (targetIdxKey in this.nodeMappingHelper.mapping.newMappings) {
                    currentRelationship.targetNode = this.nodeMappingHelper.mapping.newMappings[targetIdxKey];
                } else {
                    // TODO: handle error here
                    // if no index mapping then something happened and no node was associated
                }

                // if user select from node type/node type property
                // this means they want to create a relationship to
                // an existing knowledge graph node
                if (group.controls.mappedNodeType.value && group.controls.mappedNodeType.value) {
                    // only for target node
                    currentRelationship.targetNode = {
                        ...currentRelationship.targetNode,
                        mappedToUniversalGraph: {
                            universalGraphNodeType: group.controls.mappedNodeType.value,
                            universalGraphNodePropertyLabel: group.controls.mappedNodeProperty.value,
                        },
                    };
                }
                relationshipMapper.push(currentRelationship);
            });
            mappings.relationships = relationshipMapper;
        }

        // add the nodes without index keys
        let nodeMapper = [];
        for (const [key, value] of Object.entries(this.nodeMappingHelper.mapping.newMappings)) {
            nodeMapper.push(value);
        }

        mappings.newNodes = nodeMapper;

        nodeMapper = [];
        for (const [key, value] of Object.entries(this.nodeMappingHelper.mapping.existingMappings)) {
            nodeMapper.push(value);
        }

        mappings.existingNodes = nodeMapper;
        mappings.delimiters = this.nodeMappingHelper.mapping.delimiters;
        mappings.sheetName = this.chosenSheetToMap.sheetName;
        mappings.fileName = this.fileName;

        this.store.dispatch(uploadNodeMapping({payload: mappings}));
    }
}
