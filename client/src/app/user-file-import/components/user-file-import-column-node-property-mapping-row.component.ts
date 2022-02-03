import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormArray } from '@angular/forms';
import { MatCheckboxChange } from '@angular/material/checkbox';

import { ColumnNameIndex } from 'app/interfaces/user-file-import.interface';

@Component({
  selector: 'app-user-file-import-column-node-property-mapping-row',
  templateUrl: 'user-file-import-column-node-property-mapping-row.component.html'
})
export class UserFileImportColumnNodePropertyMappingRowComponent {
    @Input() columnHeaders: ColumnNameIndex[];
    @Input() nodePropertyMappingForm: FormGroup;

    @Output() deleteMapping: EventEmitter<boolean>;

    constructor() {
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

    setUnique(event: MatCheckboxChange) {
      const nodePropertyControl = this.nodePropertyMappingForm.get('nodeProperty') as FormArray;
      if (event.checked) {
        this.nodePropertyMappingForm.patchValue({unique: Object.keys(nodePropertyControl.value)[0]});
      }
    }
}

