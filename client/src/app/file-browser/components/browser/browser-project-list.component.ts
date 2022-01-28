import { Component, OnDestroy, OnInit } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { mergeMap, shareReplay } from 'rxjs/operators';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { PaginatedRequestOptions } from 'app/shared/schemas/common';
import { addStatus, PipeStatus } from 'app/shared/pipes/add-status.pipe';

import { ProjectsService } from '../../services/projects.service';
import { ProjectActions } from '../../services/project-actions';
import { ProjectList } from '../../models/project-list';
import { ProjectImpl } from '../../models/filesystem-object';

@Component({
  selector: 'app-browser-project-list',
  templateUrl: './browser-project-list.component.html',
})
export class BrowserProjectListComponent implements OnInit, OnDestroy {
  protected readonly subscriptions = new Subscription();
  readonly paging$ = new BehaviorSubject<PaginatedRequestOptions>({
    page: 1,
    limit: 50,
    sort: 'name',
  });
  readonly projectList$: Observable<PipeStatus<ProjectList>> = this.paging$.pipe(
    mergeMap((options) => addStatus(this.projectService.list(options))),
    shareReplay(),
  );

  constructor(protected readonly projectService: ProjectsService,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly progressDialog: ProgressDialog,
              protected readonly ngbModal: NgbModal,
              protected readonly projectActions: ProjectActions) {
  }

  ngOnInit() {
    this.subscriptions.add(this.projectList$.subscribe());
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  openCreateDialog() {
    this.projectActions.openCreateDialog().then(project => {
      this.workspaceManager.navigate(project.getCommands());
    }, () => {
    });
  }

  projectDragStart(event: DragEvent, project: ProjectImpl) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    project.addDataTransferData(dataTransfer);
  }
}
