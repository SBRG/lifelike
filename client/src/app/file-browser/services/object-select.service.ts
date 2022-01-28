import { Injectable, OnDestroy } from '@angular/core';

import { from, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from './filesystem.service';
import { ProjectList } from '../models/project-list';
import { ProjectsService } from './projects.service';

@Injectable()
export class ObjectSelectService implements OnDestroy {
  multipleSelection = false;
  objectFilter: (item: FilesystemObject) => boolean;

  hashId: string;
  projectList$: Observable<ProjectList> = from([]);
  object$: Observable<FilesystemObject> = from([]);
  projectList: ProjectList;
  object: FilesystemObject;

  private annotationSubscription: Subscription;

  constructor(private readonly projectService: ProjectsService,
              private readonly filesystemService: FilesystemService) {
    this.load(null);
  }

  ngOnDestroy(): void {
    if (this.annotationSubscription) {
      this.annotationSubscription.unsubscribe();
      this.annotationSubscription = null;
    }
  }

  private applyInput() {
    if (this.object != null) {
      this.object.children.multipleSelection = this.multipleSelection;
      this.object.children.filter = this.objectFilter;
    }
  }

  load(hashId: string): Observable<any> {
    this.hashId = hashId;
    this.projectList$ = from([]);
    this.object$ = from([]);
    this.projectList = null;
    this.object = null;

    if (hashId == null) {
      const projectList$ = this.projectService.list();
      this.projectList$ = projectList$;
      return projectList$;
    } else {
      const object$ = this.filesystemService.get(hashId).pipe(map(object => {
        if (this.annotationSubscription) {
          this.annotationSubscription.unsubscribe();
          this.annotationSubscription = null;
        }
        this.annotationSubscription = this.filesystemService.annotate(object);
        this.object = object;
        this.applyInput();
        return object;
      }));
      this.object$ = object$;
      return object$;
    }
  }

  open(target: FilesystemObject) {
    if (target.isDirectory) {
      this.load(target.hashId);
    }
  }

  goUp() {
    if (this.object != null && this.object.parent != null) {
      this.load(this.object.parent.hashId);
    } else {
      this.load(null);
    }
  }
}
