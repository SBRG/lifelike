import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';

import { Subject, Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import {
  EdgeConnectionData,
  DuplicateEdgeConnectionData,
  NewClusterSnippetsPageRequest,
  NewEdgeSnippetsPageRequest,
  SidenavSnippetData,
  NewNodePairSnippetsPageRequest,
  AssociationSnippet,
} from 'app/interfaces';
import { getPubtatorSearchUrl, SNIPPET_PAGE_LIMIT, SNIPPET_RESULT_LIMIT } from 'app/shared/constants';
import { GenericDataProvider } from 'app/shared/providers/data-transfer-data/generic-data.provider';

@Component({
    selector: 'app-snippet-display',
    templateUrl: './snippet-display.component.html',
    styleUrls: ['./snippet-display.component.scss']
})
export class SnippetDisplayComponent implements OnChanges, OnDestroy {
    @Output() requestNewPageEmitter: EventEmitter<
      NewClusterSnippetsPageRequest |
      NewEdgeSnippetsPageRequest |
      NewNodePairSnippetsPageRequest
    >;
    @Input() isNewEntity: boolean;
    @Input() totalResults: number;
    @Input() snippetData: SidenavSnippetData[];
    @Input() queryData: EdgeConnectionData | DuplicateEdgeConnectionData[];
    @Input() legend: Map<string, string[]>;

    initNewEntity: boolean;

    loadingDataSource: Subject<boolean>;
    completeSubjectsSource: Subject<boolean>;
    dataLoaded$: Observable<boolean>;
    dataLoaded: boolean;

    // Pagination properties
    page: number;
    maxPages: number;
    pageButtons: number[];
    pageLimit: number;
    resultLimit: number;

    pageLimitList: number[];
    limitChanged: boolean;

    constructor() {
        this.page = 1;
        this.pageLimit = SNIPPET_PAGE_LIMIT;
        this.resultLimit = SNIPPET_RESULT_LIMIT;
        this.maxPages = 1;
        this.requestNewPageEmitter = new EventEmitter<NewClusterSnippetsPageRequest | NewEdgeSnippetsPageRequest>();

        this.pageLimitList = [10, 25, 50, 100];
        this.limitChanged = false;

        this.dataLoaded = false;
        this.loadingDataSource = new Subject<boolean>();
        this.completeSubjectsSource = new Subject<boolean>();
        this.dataLoaded$ = this.loadingDataSource.asObservable().pipe(takeUntil(this.completeSubjectsSource));

        // Always init when a new component is generated
        this.initNewEntity = true;

        this.dataLoaded$.subscribe(() => {
            if (this.initNewEntity || this.limitChanged) {
                this.limitChanged = false;

                // After the first time pages are init-ed, only init them again if we got data for a new entity
                this.initPages();
            }
        });
    }

    ngOnChanges(changes: SimpleChanges) {
      if (changes.hasOwnProperty('isNewEntity')) {
        // An update to isNewEntity indicates that new data was requested -- either for a new entity
        // or for the first time for an existing one -- so set dataLoaded to false until snippetData is updated.
        this.dataLoaded = false;
        this.initNewEntity = changes.isNewEntity.currentValue;
      }

      if (changes.hasOwnProperty('snippetData')) {
        this.dataLoaded = true;
        this.loadingDataSource.next(true);
      }
    }

    ngOnDestroy() {
        this.completeSubjectsSource.next(true);
    }

    initPages() {
        this.page = 1;
        this.maxPages = Math.ceil(
            this.resultLimit > this.totalResults ?
                (this.totalResults / this.pageLimit) :
                (this.resultLimit / this.pageLimit)
        );
        this.setPageButtons();
    }

    previousPage() {
        this.page -= 1;
        this.setPageButtons();
        this.requestPage();
    }

    nextPage() {
        this.page += 1;
        this.setPageButtons();
        this.requestPage();
    }

    goToPage(page: number) {
        this.page = page;
        this.setPageButtons();
        this.requestPage();
    }

    setPageButtons() {
        this.pageButtons = [];
        if (this.page - 1 > 1) {
            this.pageButtons.push(this.page - 1);
        }
        if (this.page !== 1 && this.page !== this.maxPages) {
            this.pageButtons.push(this.page);
        }
        if (this.page + 1 < this.maxPages) {
            this.pageButtons.push(this.page + 1);
        }
    }

    onLimitChange(event) {
        this.pageLimit = parseInt(event.target.value, 10);
        // Need to reset the page, otherwise we might request a weird page/pageLimit combo
        this.page = 1;

        this.limitChanged = true;

        // Also request updated data with the new limit
        this.requestPage();
    }

    requestPage() {
        this.dataLoaded = false;
        this.requestNewPageEmitter.emit({
            queryData: this.queryData,
            page: this.page,
            limit: this.pageLimit,
        } as NewClusterSnippetsPageRequest | NewEdgeSnippetsPageRequest | NewNodePairSnippetsPageRequest);
    }

    getSnippetPubtatorLink(pmid: string): string {
      return getPubtatorSearchUrl(pmid);
    }

    snippetDragStart(event: DragEvent, snippet: AssociationSnippet) {
        const dataTransfer: DataTransfer = event.dataTransfer;
        dataTransfer.setData('text/plain', snippet.reference.data.sentence);
        GenericDataProvider.setURIs(dataTransfer, [{
            title: snippet.reference.data.sentence,
            uri: snippet.publication.data.pmid ?
                this.getSnippetPubtatorLink(snippet.publication.data.pmid) :
                snippet.publication.entityUrl,
        }]);
    }
}
