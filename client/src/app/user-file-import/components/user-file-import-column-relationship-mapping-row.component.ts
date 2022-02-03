import { Component, Input, Output, EventEmitter, ViewChild, ElementRef} from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';

import { Store } from '@ngrx/store';

import { ColumnNameIndex } from 'app/interfaces/user-file-import.interface';
import { State } from 'app/root-store';

import { getNodeProperties } from '../store/actions';

@Component({
    selector: 'app-user-file-import-column-relationship-mapping-row',
    templateUrl: 'user-file-import-column-relationship-mapping-row.component.html'
})
export class UserFileImportColumnRelationshipMappingRowComponent {
    @Input() columnHeaders: ColumnNameIndex[];
    @Input() relationshipMappingForm: FormGroup;
    @Input() dbNodeTypes: string[];
    // key is node label, while values are the properties of that label
    @Input() existingNodeProperties: { [key: string]: string[] };

    @Output() deleteMapping: EventEmitter<boolean>;

    @ViewChild('newRelationshipInput', {static: false}) newRelationshipInput: ElementRef;

    disableRelationshipDropdown: boolean;

    constructor(private store: Store<State>) {
        this.deleteMapping = new EventEmitter<boolean>();
        this.disableRelationshipDropdown = false;
    }

    getKey(c) {
        if (c !== null) {
            return c[0].key;
        }
    }

    deleteMappingRow() {
        this.deleteMapping.emit(true);
    }

    selectExistingNodeType(event: MatSelectChange) {
        this.store.dispatch(getNodeProperties({payload: event.value}));
    }

    relationshipInputChange() {
        // have to use disable attribute
        // because both dropdown and input for relationship
        // share the same control
        // so if we set the control to disable then it'll disable
        // both, whereas we only want to disable one if the
        // other is used
        // TODO: better way?
        // right now it's not clearing the dropdown value once
        // disabled
        // maybe make a ViewChild of each and clear that way?
        this.disableRelationshipDropdown = (this.newRelationshipInput.nativeElement as HTMLInputElement).value ? true : false;
    }
}

