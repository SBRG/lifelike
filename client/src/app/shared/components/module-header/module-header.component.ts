import { Component, Input, EventEmitter, Output, TemplateRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

@Component({
  selector: 'app-module-header',
  templateUrl: './module-header.component.html'
})
export class ModuleHeaderComponent {
  @Input() object!: FilesystemObject;
  @Input() titleTemplate: TemplateRef<any>;
  @Input() returnUrl: string;
  @Input() showObjectMenu = true;
  @Input() showBreadCrumbs = true;
  @Input() showNewWindowButton = true;
  @Output() dragStarted = new EventEmitter();

  constructor(
    protected readonly route: ActivatedRoute,
  ) {}

  openNewWindow() {
    const url = '/' + this.route.snapshot.url.join('/');
    window.open(url);
  }
}
