import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, FormGroup } from '@angular/forms';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';

import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { PaginatedRequestOptions, StandardRequestOptions } from 'app/shared/schemas/common';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemObjectList } from '../models/filesystem-object-list';
import { FilesystemService } from '../services/filesystem.service';

@Component({
  selector: 'app-community-browser',
  templateUrl: './community-browser.component.html',
})
export class CommunityBrowserComponent implements OnInit, OnDestroy {
  private readonly defaultLocator: StandardRequestOptions = {
    limit: 100,
    page: 1,
    sort: '-creationDate',
  };
  public readonly loadTask: BackgroundTask<PaginatedRequestOptions, FilesystemObjectList> = new BackgroundTask(
    (locator: PaginatedRequestOptions) => this.filesystemService.search({
      type: 'public',
      sort: '-modificationDate',
      ...locator,
    }), // TODO
  );

  public locator: StandardRequestOptions = {
    ...this.defaultLocator,
  };

  public readonly filterForm: FormGroup = new FormGroup({
    q: new FormControl(''),
    limit: new FormControl(100),
  });

  list: FilesystemObjectList = new FilesystemObjectList();

  private routerParamSubscription: Subscription;
  private loadTaskSubscription: Subscription;

  constructor(private readonly workspaceManager: WorkspaceManager,
              private readonly filesystemService: FilesystemService,
              private readonly progressDialog: ProgressDialog,
              private readonly ngbModal: NgbModal,
              private readonly route: ActivatedRoute,
              private readonly router: Router) {
  }

  ngOnInit() {
    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result: list}) => {
      this.list = list;
    });

    this.routerParamSubscription = this.route.queryParams.pipe(
      tap((params) => {
        this.locator = {
          ...this.defaultLocator,
          ...params,
          // Cast to integer
          page: params.hasOwnProperty('page') ? parseInt(params.page, 10) : this.defaultLocator.page,
          limit: params.hasOwnProperty('limit') ? parseInt(params.limit, 10) : this.defaultLocator.limit,
        };
        this.filterForm.patchValue(this.locator);
        this.refresh();
      }),
    ).subscribe();
  }

  ngOnDestroy() {
    this.loadTaskSubscription.unsubscribe();
    this.routerParamSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update(this.locator);
  }

  search() {
    this.workspaceManager.navigate(['/community'], {
      queryParams: {
        ...this.locator,
        ...this.filterForm.value,
      },
    });
  }

  goToPage(page: number) {
    this.workspaceManager.navigate(['/community'], {
      queryParams: {
        ...this.locator,
        page,
      },
    });
  }

  getObjectCommands(object: FilesystemObject): any[] {
    return ['/projects', object.project.projectName, 'maps', object.hashId];
  }
}
