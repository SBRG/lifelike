import { Component, EventEmitter, Input, Output } from '@angular/core';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { WorkspaceManager } from 'app/shared/workspace-manager';

@Component({
  selector: 'app-object-path',
  templateUrl: './object-path.component.html',
})
export class ObjectPathComponent {

  @Input() rootName = null;
  @Input() forEditing = true;
  _object: FilesystemObject | undefined;
  path: FilesystemObject[] = [];
  @Input() newTab = false;
  @Output() refreshRequest = new EventEmitter<any>();

  constructor(protected readonly workspaceManager: WorkspaceManager) {
  }

  @Input()
  set object(object: FilesystemObject | undefined) {
    this._object = object;
    this.path = this.getPath(object);
  }

  private getPath(object: FilesystemObject | undefined): FilesystemObject[] {
    let current = object;
    const path = [];
    while (current != null) {
      path.push(current);
      current = current.parent;
    }
    return path.reverse();
  }

  openObject(target: FilesystemObject) {
    this.workspaceManager.navigate(target.getCommands(false), {
      newTab: true,
    });
  }

}
