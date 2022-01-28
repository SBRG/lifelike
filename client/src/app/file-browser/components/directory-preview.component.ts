import { Component, Input } from '@angular/core';

import { CollectionModel } from 'app/shared/utils/collection-model';

import { FilesystemObject } from '../models/filesystem-object';

@Component({
  selector: 'app-directory-preview',
  templateUrl: './directory-preview.component.html',
})
export class DirectoryPreviewComponent {

  @Input() objects: CollectionModel<FilesystemObject> | undefined;

}
