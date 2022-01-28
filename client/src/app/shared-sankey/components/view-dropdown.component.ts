import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';

import { transform, pick, omitBy, isNil, mapValues, defer, omit } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { first, map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { SankeyControllerService } from 'app/sankey-viewer/services/sankey-controller.service';
import { mergeDeep } from 'app/graph-viewer/utils/objects';
import { CustomisedSankeyLayoutService } from 'app/sankey-viewer/services/customised-sankey-layout.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { WarningControllerService } from 'app/shared/services/warning-controller.service';
import { frozenEmptyObject } from 'app/shared/utils/types';
import { SankeySearchService } from 'app/sankey-viewer/services/search.service';

import {
  SankeyView,
  SankeyNodesOverwrites,
  SankeyLinksOverwrites,
  SankeyURLLoadParams,
  SankeyURLLoadParam,
  SankeyApplicableView,
  ViewBase
} from '../interfaces';
import { SankeyViewConfirmComponent } from './view-confirm.component';
import { SankeyViewCreateComponent } from './view-create.component';
import { viewBaseToNameMapping } from '../constants';
import { SankeyLink, SankeyNode } from '../pure_interfaces';

@Component({
  selector: 'app-sankey-view-dropdown',
  templateUrl: 'view-dropdown.component.html',
  styleUrls: ['./view-dropdown.component.scss']
})
export class SankeyViewDropdownComponent implements OnChanges {

  @Input() set activeViewName(viewName) {
    if (viewName) {
      const view = this.views[viewName];
      if (view) {
        this._activeViewName = viewName;
        this._activeView = view;
      } else {
        this.warningController.warn(`View ${viewName} has not been found in file.`);
      }
    } else {
      this._activeView = undefined;
      this._activeViewName = undefined;
    }
  }

  get activeViewName() {
    return this._activeViewName;
  }

  get activeView() {
    return this._activeView;
  }

  constructor(
    readonly workspaceManager: WorkspaceManager,
    readonly sankeyController: SankeyControllerService,
    private modalService: NgbModal,
    readonly warningController: WarningControllerService,
    public sankeySearch: SankeySearchService
  ) {
  }

  get views(): { [key: string]: object } {
    // make sure that default value is not extended - unintended use
    return this.sankeyController.allData?.value._views ?? frozenEmptyObject;
  }

  get activeViewBase(): ViewBase {
    return this.sankeyController.viewBase;
  }

  get activeViewBaseName(): string {
    return viewBaseToNameMapping[this.activeViewBase] ?? '';
  }

  @Input() preselectedViewBase: string;
  @Input() object: FilesystemObject;

  @Output() activeViewNameChange = new EventEmitter<string>();
  @Output() viewDataChanged = new EventEmitter();

  readonly nodeViewProperties: Array<keyof SankeyNode> = [
    '_layer',
    '_fixedValue',
    '_value',
    '_depth',
    '_height',
    '_x0',
    '_x1',
    '_y0',
    '_y1',
    '_order'
  ];
  readonly linkViewProperties: Array<keyof SankeyLink> = [
    '_value',
    '_multiple_values',
    '_y0',
    '_y1',
    '_circular',
    '_width',
    '_order',
    '_adjacent_divider',
    '_id'
  ];
  readonly statusOmitProperties = ['viewName', 'baseViewName'];
  private _activeViewName: string;
  private _activeView;

  viewBase = ViewBase;

  confirm({header, body}): Promise<any> {
    const modal = this.modalService.open(
      SankeyViewConfirmComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    modal.componentInstance.header = header;
    modal.componentInstance.body = body;
    return modal.result;
  }

  ngOnChanges({preselectedViewBase, activeViewName}: SimpleChanges): void {
    if (activeViewName || preselectedViewBase) {
      if (!isNil(this.activeViewName)) {
        this.applyActiveView();
      } else if (!isNil(this.preselectedViewBase)) {
        this.changeViewBaseIfNeeded(this.preselectedViewBase);
      }
    }
  }

  createView(viewName): Promise<any> {
    return this.sankeyController.sankeySize$.pipe(
      first(),
      map(size => {
        const renderedData = this.sankeyController.dataToRender.value;
        this.sankeyController.allData.value._views[viewName] = {
          state: omit(this.sankeyController.state, this.statusOmitProperties),
          base: this.activeViewBase,
          size,
          nodes: this.mapToPropertyObject(renderedData.nodes, this.nodeViewProperties),
          links: this.mapToPropertyObject(renderedData.links, this.linkViewProperties)
        } as SankeyView;
        this.sankeyController.state.viewName = viewName;
        this.viewDataChanged.emit();
      })
    ).toPromise();
  }

  changeViewBaseIfNeeded(base, params?): Promise<boolean> | void {
    if (this.activeViewBase !== base) {
      return this.openBaseView(base, params);
    }
  }

  applyView(viewName, view: SankeyApplicableView): void {
    if (!this.changeViewBaseIfNeeded(view.base, {[SankeyURLLoadParam.VIEW_NAME]: viewName})) {
      const {state = {}, nodes = {}, links = {}, base} = view;
      mergeDeep(this.sankeyController.state, omitBy(state, this.statusOmitProperties), {
        viewName, baseViewName: base
      });
      const graph = this.sankeyController.computeData();
      graph._precomputedLayout = view.size;
      this.applyPropertyObject(nodes, graph.nodes);
      this.applyPropertyObject(links, graph.links);
      // @ts-ignore
      const layout = new CustomisedSankeyLayoutService();
      layout.computeNodeLinks(graph);
      this.sankeyController.dataToRender.next(graph);
    }
  }

  objectToFragment(obj): string {
    return new URLSearchParams(
      mapValues(
        omitBy(
          obj,
          isNil
        ),
        String
      )
    ).toString();
  }

  mapToPropertyObject(entities: Partial<SankeyNode | SankeyLink>[], properties): SankeyNodesOverwrites | SankeyLinksOverwrites {
    return transform(entities, (result, entity) => {
      result[entity._id] = pick(entity, properties);
    }, {});
  }

  applyPropertyObject(
    propertyObject: SankeyNodesOverwrites | SankeyLinksOverwrites,
    entities: Array<SankeyNode | SankeyLink>
  ): void {
    // for faster lookup
    const entityById = new Map(entities.map((d, i) => [String(d._id), d]));
    Object.entries(propertyObject).map(([id, properties]) => {
      const entity = entityById.get(id);
      if (entity) {
        Object.assign(entity, properties);
      } else {
        this.warningController.warn(`No entity found for id ${id}`);
      }
    });
  }

  applyActiveView(): void {
    defer(() => this.applyView(this.activeViewName, this.activeView));
  }

  openBaseView(baseView: ViewBase, params?: Partial<SankeyURLLoadParams>): Promise<boolean> {
    const {object} = this;
    return this.workspaceManager.navigateByUrl({
      url: `/projects/${object.project.name}/${baseView}/${object.hashId}#${
        this.objectToFragment({
          [SankeyURLLoadParam.NETWORK_TRACE_IDX]: this.sankeyController.state.networkTraceIdx,
          [SankeyURLLoadParam.BASE_VIEW_NAME]: baseView,
          [SankeyURLLoadParam.SEARCH_TERMS]: this.sankeySearch.entitySearchTerm.value,
          ...params
        } as SankeyURLLoadParams)
      }`
    });
  }

  saveView(): Promise<any> {
    if (!this.sankeyController.allData.value._views) {
      this.sankeyController.allData.value._views = {};
    }
    const createDialog = this.modalService.open(
      SankeyViewCreateComponent,
      {ariaLabelledBy: 'modal-basic-title'}
    );
    return createDialog.result.then(({viewName}) => this.confirmCreateView(viewName));
  }

  confirmCreateView(viewName) {
    if (this.views[viewName]) {
      return this.confirm({
        header: 'Confirm overwrite',
        body: `Saving this view as '${viewName}' will overwrite existing view. Would you like to continue?`
      }).then(() => {
        this.createView(viewName);
      });
    } else {
      return this.createView(viewName);
    }
  }

  deleteView(viewName): void {
    delete this.sankeyController.allData.value._views[viewName];
    if (this.activeViewName === viewName) {
      this.activeViewNameChange.emit(undefined);
    }
    this.viewDataChanged.emit();
  }

  confirmDeleteView(viewName): void {
    this.confirm({
      header: 'Confirm delete',
      body: `Are you sure you want to delete the '${viewName}' view?`
    }).then(() => {
      this.deleteView(viewName);
    });
  }
}
