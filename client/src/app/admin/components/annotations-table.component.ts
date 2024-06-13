import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormControl, FormGroup } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { HttpEventType } from '@angular/common/http';

import { BehaviorSubject, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';

import { GlobalAnnotationService } from 'app/shared/services/global-annotation-service';
import { GlobalAnnotationListItem } from 'app/interfaces/annotation';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { downloader } from 'app/shared/utils';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { Progress } from 'app/interfaces/common-dialog.interface';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import {
  PaginatedRequestOptions,
  ResultList,
  StandardRequestOptions,
} from 'app/shared/schemas/common';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { getProgressStatus } from 'app/shared/components/dialog/progress-dialog.component';

@Component({
    selector: 'app-annotations-table',
    templateUrl: './annotations-table.component.html',
})
export class AnnotationTableComponent implements OnInit, OnDestroy {

    collectionSize = 0;
    currentPage = 1;
    readonly pageSize = 100;
    selection = new SelectionModel(true, []);
    globalAnnotationTypeChoices = ['Inclusion', 'Exclusion'];
    globalAnnotationType = 'inclusion';

    private readonly defaultLocator: StandardRequestOptions = {
        limit: 100,
        page: 1,
        sort: '',
    };

    readonly filterForm: FormGroup = new FormGroup({
        q: new FormControl(''),
        limit: new FormControl(100),
    });

    readonly loadTask: BackgroundTask<PaginatedRequestOptions, ResultList<GlobalAnnotationListItem>> = new BackgroundTask(
        (locator: PaginatedRequestOptions) => this.globalAnnotationService.getAnnotations(
            locator, this.globalAnnotationType),
    );

    locator: StandardRequestOptions = {
        ...this.defaultLocator,
    };

    readonly results = new CollectionModel<GlobalAnnotationListItem>([], {
        multipleSelection: true,
    });

    protected subscriptions = new Subscription();

    readonly headers: string[] = [
        'Open File',
        'Text',
        'Case Insensitive',
        'Type',
        'Entity Type',
        'Entity ID',
        'File Deleted',
        'Added By',
        'Reason',
        'Comment',
        'Date Added'
    ];

    constructor(
        private globalAnnotationService: GlobalAnnotationService,
        private readonly route: ActivatedRoute,
        private readonly errorHandler: ErrorHandler,
        private readonly progressDialog: ProgressDialog,
        private readonly filesystemService: FilesystemService,
        private readonly filesystemObjectActions: FilesystemObjectActions,
    ) {}

    ngOnInit() {
        this.subscriptions.add(this.loadTask.results$.subscribe(({result: annotations}) => {
            this.collectionSize = annotations.total;
            this.results.replace(annotations.results);
        }));

        this.subscriptions.add(this.route.queryParams.pipe(
            tap((params) => {
                this.locator = {
                    ...this.defaultLocator,
                    ...params,
                    page: params.hasOwnProperty('page') ? parseInt(params.page, 10) : this.defaultLocator.page,
                    limit: params.hasOwnProperty('limit') ? parseInt(params.limit, 10) : this.defaultLocator.limit,
                };
                this.filterForm.patchValue(this.locator);
                this.refresh();
            }),
        ).subscribe());
    }

    ngOnDestroy() {
        this.subscriptions.unsubscribe();
    }

    selectGlobalType(selection: string) {
        this.globalAnnotationType = selection.toLowerCase();
        this.goToPage(1);
    }

    goToPage(page: number) {
        this.currentPage = page;
        this.locator = {...this.locator, page};
        this.subscriptions.add(this.globalAnnotationService.getAnnotations(
            this.locator, this.globalAnnotationType).pipe().subscribe(
            (annotations => {
                this.collectionSize = annotations.total;
                this.results.replace(annotations.results);
            })
        ));
    }

    isAllSelected(): boolean {
        if (!this.selection.selected.length) {
            return false;
        }
    }

    toggleAllSelected(): void {
        if (this.isAllSelected()) {

        }
    }

    refresh() {
        this.loadTask.update(this.locator);
    }

    openNewWindow(fileHashId: string) {
        this.filesystemService.get(fileHashId).pipe().subscribe(fileObject =>
            this.filesystemObjectActions.openNewWindow(fileObject));
    }

    deleteAnnotation(objects: readonly GlobalAnnotationListItem[]) {
        const pids = objects.map((r: GlobalAnnotationListItem) => [r.globalId, r.synonymId ? r.synonymId : -1]);
        this.subscriptions.add(this.globalAnnotationService.deleteAnnotations(pids).pipe().subscribe());
        this.refresh();
    }

    exportGlobalExclusions() {
        const progressObservables = [new BehaviorSubject<Progress>(new Progress({
            status: 'Preparing file for download...'
        }))];
        const progressDialogRef = this.progressDialog.display({
            title: `Exporting global exclusions`,
            progressObservables,
        });

        this.subscriptions.add(this.globalAnnotationService.exportGlobalExclusions().pipe(
            this.errorHandler.create({label: 'Export global exclusion'})
        ).subscribe(event => {
            if (event.type === HttpEventType.DownloadProgress) {
                progressObservables[0].next(getProgressStatus(event, '...', '...'));
            } else if (event.type === HttpEventType.Response) {
                progressDialogRef.close();
                const filename = event.headers.get('content-disposition').split('=')[1];
                downloader(event.body, 'application/vnd.ms-excel', filename);
            }
        }));
    }

    exportGlobalInclusions() {
        const progressObservables = [new BehaviorSubject<Progress>(new Progress({
            status: 'Preparing file for download...'
        }))];
        const progressDialogRef = this.progressDialog.display({
            title: `Exporting global inclusions`,
            progressObservables,
        });

        this.subscriptions.add(this.globalAnnotationService.exportGlobalInclusions().pipe(
            this.errorHandler.create({label: 'Export global inclusion'})
        ).subscribe(event => {
            if (event.type === HttpEventType.DownloadProgress) {
                progressObservables[0].next(getProgressStatus(event, '...', '...'));
            } else if (event.type === HttpEventType.Response) {
                progressDialogRef.close();
                const filename = event.headers.get('content-disposition').split('=')[1];
                downloader(event.body, 'application/vnd.ms-excel', filename);
            }
        }));
    }
}
