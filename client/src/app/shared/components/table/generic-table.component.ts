import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
} from '@angular/core';

import { Subscription } from 'rxjs';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { HighlightTextService } from '../../services/highlight-text.service';

@Component({
  selector: 'app-generic-table',
  templateUrl: './generic-table.component.html',
  styleUrls: ['./generic-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenericTableComponent implements OnInit, OnDestroy {
  HEADER: TableHeader[][];

  // Number of columns can be inferred from the headers
  numColumns: number[];

  protected readonly subscriptions = new Subscription();

  @Input() object: FilesystemObject | undefined;
  // Probably don't need setters for all of these
  @Input()
  set header(header: TableHeader[][]) {
    this.HEADER = header;
    const num = Math.max.apply(null, header.map(x => x.reduce((a, b) => a + parseInt(b.span, 10), 0)));
    this.numColumns = new Array(num);
  }
  @Input() entries: TableCell[][];

  constructor(protected readonly highlightTextService: HighlightTextService,
              protected readonly elementRef: ElementRef) {
  }

  ngOnInit() {
    this.subscriptions.add(this.highlightTextService.addEventListeners(this.elementRef.nativeElement, {
      object: this.object,
    }));
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }
}

export interface TableCell {
  text: string;
  singleLink?: TableLink;
  multiLink?: TableLink[];
  highlight?: boolean;
}

export interface TableLink {
  link: string;
  linkText: string;
}

export interface TableHeader {
  name: string;
  span: string;
}
