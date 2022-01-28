import { Component, Input, OnDestroy, OnInit } from '@angular/core';

import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';

import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObjectList } from 'app/file-browser/models/filesystem-object-list';
import { FilesystemObject} from 'app/file-browser/models/filesystem-object';
import { CreateActionOptions } from 'app/file-types/providers/base-object.type-provider';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { MimeTypes } from 'app/shared/constants';

@Component({
  selector: 'app-associated-maps',
  templateUrl: './associated-maps.component.html',
})
export class AssociatedMapsComponent implements OnInit, OnDestroy {
  @Input() object: FilesystemObject;

  private loadTaskSubscription: Subscription;

  readonly loadTask: BackgroundTask<string, FilesystemObjectList> = new BackgroundTask(
    hashId => this.filesystemService.search({
      type: 'linked',
      linkedHashId: hashId,
      mimeTypes: ['vnd.lifelike.document/map'],
    }),
  );

  hashId: string;
  list: FilesystemObjectList;

  constructor(protected readonly filesystemService: FilesystemService,
              protected readonly filesystemObjectActions: FilesystemObjectActions,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly objectTypeService: ObjectTypeService,
              protected readonly errorHandler: ErrorHandler) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: list}) => {
      this.list = list;
    });

    this.refresh();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update(this.object.hashId);
  }

  openMapCreateDialog() {
    const options: CreateActionOptions = {
      parent: this.object.parent,
      createDialog: {
        promptParent: true,
      },
    };

    const testMap = new FilesystemObject();
    testMap.mimeType = MimeTypes.Map;
    this.objectTypeService.get(testMap).pipe(
      tap(provider => provider.getCreateDialogOptions()[0].item.create(options).then(
        object => this.workspaceManager.navigate(object.getCommands(), {
          newTab: true,
        }),
        () => {
        },
      )),
      this.errorHandler.create({label: 'Create map'}),
    ).subscribe();
  }
}
