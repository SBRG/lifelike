import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup } from '@angular/forms';

import { ColumnNameIndex } from 'app/interfaces/user-file-import.interface';

@Component({
    selector: 'app-user-file-import-column-delimiter-row',
    templateUrl: 'user-file-import-column-delimiter-row.component.html',
})
export class UserFileImportColumnDelimiterRowComponent {

    @Input() columnHeaders: ColumnNameIndex[];

    @Input() columnDelimiterForm: FormGroup;

    @Output() deleteDelimiter: EventEmitter<boolean>;

    readonly delimiters = [';', ','];

    constructor() {
        this.deleteDelimiter = new EventEmitter<boolean>();
    }

    getKey(c) {
        if (c !== null) {
            return c[0].key;
        }
    }

    deleteDelimiterRow() {
        this.deleteDelimiter.emit(true);
    }
}
