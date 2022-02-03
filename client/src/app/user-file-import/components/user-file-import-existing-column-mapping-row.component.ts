import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatSelectChange } from '@angular/material/select';

import { Store } from '@ngrx/store';

import { ColumnNameIndex } from 'app/interfaces/user-file-import.interface';
import { State } from 'app/root-store';

import { getNodeProperties } from '../store/actions';

@Component({
  selector: 'app-user-file-import-existing-column-mapping-row',
  templateUrl: 'user-file-import-existing-column-mapping-row.component.html'
})
export class UserFileImportExistingColumnMappingRowComponent {
    @Input() columnHeaders: ColumnNameIndex[];
    @Input() columnMappingForm: FormGroup;
    @Input() existingNodeLabels: string[];
    // key is node label, while values are the properties of that label
    @Input() existingNodeProperties: { [key: string]: string[] };

    @Output() deleteMapping: EventEmitter<boolean>;

    constructor(private store: Store<State>) {
      this.deleteMapping = new EventEmitter<boolean>();
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
}
