import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'app-bioc-table-view',
  templateUrl: './bioc-table-view.component.html',
  styleUrls: ['./bioc-table-view.component.scss']
})
export class BiocTableViewComponent implements OnInit {
  @Input() passage;
  constructor() { }

  ngOnInit() {
  }

  tableCaption(passage) {
    const TYPES = ['table_caption'];
    const infons = passage.infons || {};
    const type = infons.type && infons.type.toLowerCase();
    const res = TYPES.includes(type);
    if (res && passage.infons.id) {
      return passage.infons.id;
    }
    return false;
  }

  isTable(passage) {
    const TYPES = ['table'];
    const infons = passage.infons || {};
    const type = infons.type && infons.type.toLowerCase();
    const res = TYPES.includes(type);
    return res;
  }

  isTableFootnote(passage) {
    const TYPES = ['table_footnote'];
    const infons = passage.infons || {};
    const type = infons.type && infons.type.toLowerCase();
    const res = TYPES.includes(type);
    return res;
  }

  advancedView(passage) {
    const infons = passage.infons || {};
    const xml = infons.xml && infons.xml.toLowerCase();
    if (xml) {
      const idx = xml.indexOf('<table');
      if (idx >= 0) {
        return xml.substring(idx);
      }
    }
    return false;
  }

}
