import { Component, ElementRef, EventEmitter, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';

import { FTSQueryRecord, FTSResult } from 'app/interfaces';
import { LegendService } from 'app/shared/services/legend.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ModuleProperties } from 'app/shared/modules';

import { GraphSearchService } from '../services/graph-search.service';
import { createGraphSearchParamsFromQuery, getGraphQueryParams, GraphQueryParameters } from '../utils/search';
import { GraphSearchParameters } from '../graph-search';

@Component({
  selector: 'app-graph-search',
  templateUrl: './graph-search.component.html',
})
export class GraphSearchComponent implements OnInit, OnDestroy {
  @ViewChild('body', {static: false}) body: ElementRef;

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  readonly loadTask: BackgroundTask<GraphSearchParameters, FTSResult> = new BackgroundTask(params => {
    return this.searchService.visualizerSearch(
      params.query,
      params.organism,
      params.page,
      params.limit,
      params.domains,
      params.entities,
    );
  });

  params: GraphSearchParameters | undefined;
  collectionSize = 0;
  results: FTSQueryRecord[] = [];

  legend: Map<string, string> = new Map();

  private valuesSubscription: Subscription;
  routerParamSubscription: Subscription;
  loadTaskSubscription: Subscription;

  constructor(
    private route: ActivatedRoute,
    private searchService: GraphSearchService,
    private legendService: LegendService,
    private workspaceManager: WorkspaceManager,
  ) {
  }

  ngOnInit() {
    this.valuesSubscription = this.loadTask.values$.subscribe(value => {
      this.modulePropertiesChange.emit({
        title: value.query != null && value.query.length ? `Knowledge Graph: ${value.query}` : 'Knowledge Graph',
        fontAwesomeIcon: 'fas fa-chart-network',
      });
    });

    this.loadTaskSubscription = this.loadTask.results$.subscribe(({result}) => {
      const {nodes, total} = result;
      this.results = nodes;
      this.collectionSize = total;
      this.body.nativeElement.scrollTop = 0;
    });

    this.legendService.getAnnotationLegend().subscribe(legend => {
      Object.keys(legend).forEach(label => {
        // Keys of the result dict are all lowercase, need to change the first character
        // to uppercase to match Neo4j labels
        this.legend.set(label, legend[label].color);
      });
    });

    this.routerParamSubscription = this.route.queryParams.pipe(
      tap((params) => {
        if (params.q != null) {
          this.params = createGraphSearchParamsFromQuery(params as GraphQueryParameters);
          this.loadTask.update(this.params);
        } else {
          this.params = null;
          this.results = [];
          this.collectionSize = 0;
        }
        if (this.body) {
          this.body.nativeElement.scrollTop = 0;
        }
      }),
    ).subscribe();
  }

  ngOnDestroy() {
    this.routerParamSubscription.unsubscribe();
    this.loadTaskSubscription.unsubscribe();
    this.valuesSubscription.unsubscribe();
  }

  refresh() {
    this.loadTask.update(this.params);
  }

  search(params: GraphSearchParameters) {
    this.workspaceManager.navigate(['/search'], {
      queryParams: {
        ...getGraphQueryParams(params),
        t: new Date().getTime(), // Hack so if the person press search without changing anything, we still refresh
      },
    });
  }

  goToPage(page: number) {
    this.search({
      ...this.params,
      page,
    });
  }
}
