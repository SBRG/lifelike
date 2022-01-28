import { OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Observable, Subscription } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { BackgroundTask } from '../../rxjs/background-task';
import { CollectionModel } from '../../utils/collection-model';
import { WorkspaceManager } from '../../workspace-manager';
import { ResultList, ResultQuery } from '../../schemas/common';

export abstract class ResultListComponent<O, R, RL extends ResultList<R> = ResultList<R>> implements OnInit, OnDestroy {
  public loadTask: BackgroundTask<O, RL> = new BackgroundTask(params => this.getResults(params));

  public params: O = this.getDefaultParams();

  public collectionSize = 0;
  public resultQuery: ResultQuery;
  public results = new CollectionModel<R>([], {
    multipleSelection: true,
  });

  protected subscriptions = new Subscription();

  constructor(protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager) {
  }

  ngOnInit() {
    this.subscriptions.add(this.loadTask.values$.subscribe(value => {
      this.valueChanged(value);
    }));

    this.subscriptions.add(this.loadTask.results$.subscribe(({result: result}) => {
      this.collectionSize = result.total;
      this.resultQuery = result.query;
      this.results.replace(result.results);
    }));

    this.subscriptions.add(this.route.queryParams.pipe(
      mergeMap(params => this.deserializeParams(params))
    ).subscribe(params => {
      this.params = params;
      if (this.valid) {
        this.loadTask.update(this.params);
      }
    }));
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  refresh() {
    this.loadTask.update(this.params);
  }

  search(params: Partial<O>) {
    this.workspaceManager.navigate(this.route.snapshot.url.map(item => item.path), {
      queryParams: {
        ...this.serializeParams({
          ...this.getDefaultParams(),
          ...params,
        }, true),
        t: new Date().getTime(),
      },
    });
  }

  get valid(): boolean {
    return true;
  }

  valueChanged(value: O) {
  }

  abstract getResults(params: O): Observable<RL>;

  abstract getDefaultParams(): O;

  abstract deserializeParams(params: { [key: string]: string }): Observable<O>;

  abstract serializeParams(params: O, restartPagination: boolean): Record<keyof O, string>;
}
