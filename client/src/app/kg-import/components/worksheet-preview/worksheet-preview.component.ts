import { Component, Input } from '@angular/core';

import { isNil } from 'lodash-es';

import { SheetNameAndColumnNames, SheetRowPreview } from 'app/interfaces';

@Component({
    selector: 'app-worksheet-preview',
    templateUrl: './worksheet-preview.component.html',
    styleUrls: ['./worksheet-preview.component.scss']
})
export class WorksheetPreviewComponent {
    @Input() set worksheetData(worksheetData: SheetNameAndColumnNames) {
        if (!isNil(worksheetData)) {
            this.preview = worksheetData.sheetPreview;
            this.headers = worksheetData.sheetColumnNames.map(column => {
                // There should be exactly one key (column name) per element in the sheetColumnNames property
                return Object.keys(column)[0];
            });
        }
    }

    preview: SheetRowPreview[];
    headers: string[];

    constructor() {
        this.headers = [];
        this.preview = [];
     }
}
