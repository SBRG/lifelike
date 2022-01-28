import { Component, } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { groupBy, values } from 'lodash-es';

import { SankeyPathReport } from 'app/shared-sankey/interfaces';

@Component({
  selector: 'app-sankey-path-report',
  templateUrl: './path-report.component.html',
  styleUrls: ['./path-report.component.scss'],
})
export class PathReportComponent {
  pathReport: SankeyPathReport;
  _pathReportText: string;
  view: 'HTML' | 'Text' = 'HTML';

  constructor(public activeModal: NgbActiveModal) {
  }

  get pathReportText() {
    if (!this._pathReportText) {
      let text = '';
      Object.entries(this.pathReport).forEach(n => {
        const [key, val] = n;
        text += key + '\n';
        val.forEach(path => {
          const rows = values(groupBy(path, 'row'));
          rows.forEach(row => {
            const [{column}] = row;
            text += '\t'.repeat(column - 1) + row.map(e => e.label).join('') + '\n';
          });
        });
      });
      this._pathReportText = text;
    }
    return this._pathReportText;
  }
}
