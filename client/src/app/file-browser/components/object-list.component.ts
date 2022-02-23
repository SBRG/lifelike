import { Component, ElementRef, EventEmitter, Input, Output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { uniqueId } from 'lodash-es';
import { BehaviorSubject } from 'rxjs';
import { finalize, map, tap } from 'rxjs/operators';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { nullCoalesce } from 'app/shared/utils/types';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { openDownloadForBlob } from 'app/shared/utils/files';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemObjectActions } from '../services/filesystem-object-actions';
import { getObjectLabel } from '../utils/objects';
import { FilesystemService } from '../services/filesystem.service';

@Component({
  selector: 'app-object-list',
  templateUrl: './object-list.component.html',
})
export class ObjectListComponent {
  id = uniqueId('FileListComponent-');

  @Input() appLinks = false;
  @Input() forEditing = true;
  @Input() showDescription = false;
  @Input() parent: FilesystemObject | undefined;
  @Input() objects: CollectionModel<FilesystemObject> | undefined;
  @Input() objectControls = true;
  @Input() emptyDirectoryMessage = 'There are no items in this folder.';
  @Output() refreshRequest = new EventEmitter<string>();
  @Output() objectOpen = new EventEmitter<FilesystemObject>();
  MAX_TOOLTIP_LENGTH = 800;

  constructor(protected readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly actions: FilesystemObjectActions,
              protected readonly filesystemService: FilesystemService,
              protected readonly elementRef: ElementRef,
              protected readonly progressDialog: ProgressDialog) {
  }

  objectDragStart(event: DragEvent, object: FilesystemObject) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    // TODO: Move to DataTransferData framework
    object.addDataTransferData(dataTransfer);

    // At this time, we don't support dragging multiple items
    this.objects.selectOnly(object);
  }

  getDateShown(object: DirectoryObject) {
    return nullCoalesce(object.modificationDate, object.creationDate);
  }

  openParentEditDialog() {
    return this.actions.openEditDialog(this.parent).then(() => {
      this.snackBar.open(`Saved changes to ${getObjectLabel(this.parent)}.`, 'Close', {
        duration: 5000,
      });
    }, () => {
    });
  }

  openObject(target: FilesystemObject) {
    this.objectOpen.next(target);

    if (this.appLinks) {
      if (target.isOpenable) {
        this.workspaceManager.navigate(target.getCommands(), {
          newTab: !target.isDirectory,
        });
      } else {
        const progressDialogRef = this.progressDialog.display({
          title: `Download ${getObjectLabel(target)}`,
          progressObservables: [new BehaviorSubject<Progress>(new Progress({
            status: 'Generating download...',
          }))],
        });
        this.filesystemService.getContent(target.hashId).pipe(
          map(blob => {
            return new File([blob], target.filename);
          }),
          tap(file => {
            openDownloadForBlob(file, file.name);
          }),
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create({label: 'Download file'}),
        ).subscribe();
      }
    }
  }
}
