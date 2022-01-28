import {
  AfterViewInit,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { cloneDeep } from 'lodash-es';
import { Observable } from 'rxjs';
import { mergeMap, shareReplay } from 'rxjs/operators';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { getObjectLabel } from 'app/file-browser/utils/objects';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectVersion } from 'app/file-browser/models/object-version';
import { Exporter, ObjectTypeProvider } from 'app/file-types/providers/base-object.type-provider';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';

@Component({
  selector: 'app-object-menu',
  templateUrl: './object-menu.component.html',
})
export class ObjectMenuComponent implements AfterViewInit, OnChanges {

  @Input() object: FilesystemObject;
  @Input() forEditing = true;
  @Input() nameEntity = false;
  @Input() showOpen = true;
  @Input() showRestore = false;
  @Input() showDelete = false;
  @Input() showTools = true;
  @Output() refreshRequest = new EventEmitter<string>();
  @Output() objectOpen = new EventEmitter<FilesystemObject>();
  @Output() objectRefresh = new EventEmitter<FilesystemObject>();
  @Output() objectRestore = new EventEmitter<ObjectVersion>();
  @Output() objectUpdate = new EventEmitter<FilesystemObject>();
  typeProvider$: Observable<ObjectTypeProvider>;
  exporters$: Observable<Exporter[]>;

  constructor(readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly actions: FilesystemObjectActions,
              protected readonly objectTypeService: ObjectTypeService) {
    this.typeProvider$ = objectTypeService.getDefault();
  }

  private updateObjectObservables() {
    const object = this.object;
    this.typeProvider$ = this.object ? this.objectTypeService.get(this.object).pipe(
      shareReplay(),
    ) : this.objectTypeService.getDefault();
    this.exporters$ = this.typeProvider$.pipe(
      this.errorHandler.create({label: 'Get exporters'}),
      mergeMap(typeProvider => typeProvider.getExporters(object)),
      shareReplay(),
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('object' in changes) {
      this.updateObjectObservables();
    }
  }

  ngAfterViewInit() {
    this.updateObjectObservables();
  }

  openEditDialog(target: FilesystemObject) {
    return this.actions.openEditDialog(target).then(() => {
      this.snackBar.open(`Saved changes to ${getObjectLabel(target)}.`, 'Close', {
        duration: 5000,
      });
      this.objectUpdate.emit(target);
    }, () => {
    });
  }

  openCloneDialog(target: FilesystemObject) {
    const newTarget: FilesystemObject = cloneDeep(target);
    newTarget.public = false;
    return this.actions.openCloneDialog(newTarget).then(clone => {
      this.snackBar.open(`Copied ${getObjectLabel(target)} to ${getObjectLabel(clone)}.`, 'Close', {
        duration: 5000,
      });
      this.refreshRequest.next();
    }, () => {
    });
  }

  openMoveDialog(targets: FilesystemObject[]) {
    return this.actions.openMoveDialog(targets).then(({destination}) => {
      this.snackBar.open(
        `Moved ${getObjectLabel(targets)} to ${getObjectLabel(destination)}.`,
        'Close', {
          duration: 5000,
        });
      this.refreshRequest.next();
    }, () => {
    });
  }

  openDeleteDialog(targets: FilesystemObject[]) {
    return this.actions.openDeleteDialog(targets).then(() => {
      this.snackBar.open(`Deleted ${getObjectLabel(targets)}.`, 'Close', {
        duration: 5000,
      });
      this.refreshRequest.next();
    }, () => {
    });
  }

  reannotate(targets: FilesystemObject[]) {
    return this.actions.reannotate(targets).then(() => {
      this.snackBar.open(`${getObjectLabel(targets)} re-annotated.`, 'Close', {
        duration: 5000,
      });
      this.refreshRequest.next();
      this.objectRefresh.next();
    }, () => {
    });
  }

  openVersionHistoryDialog(target: FilesystemObject) {
    return this.actions.openVersionHistoryDialog(target);
  }

  openVersionRestoreDialog(target: FilesystemObject) {
    return this.actions.openVersionRestoreDialog(target).then(version => {
      this.objectRestore.next(version);
    }, () => {
    });
  }

  openExportDialog(target: FilesystemObject) {
    return this.actions.openExportDialog(target);
  }

  openShareDialog(target: FilesystemObject) {
    return this.actions.openShareDialog(target, false);
  }

  openLink(url: string) {
    window.open(url);
  }
}
