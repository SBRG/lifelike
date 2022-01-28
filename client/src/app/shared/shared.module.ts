/**
 * Commonly-used imports are grouped here for simpler use by feature modules.
 */
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TextFieldModule } from '@angular/cdk/text-field';
import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule } from '@angular/flex-layout';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { EffectsModule } from '@ngrx/effects';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { LinksPanelComponent } from 'app/drawing-tool/components/links-panel.component';

import { AngularSplitModule } from 'angular-split';
import { AngularMaterialModule } from './angular-material.module';
import { HighlightSnippetComponent } from './components/highlight-snippet.component';
import { LegendComponent } from './components/legend.component';
import { MessageDialogComponent } from './components/dialog/message-dialog.component';
import { NodeRelationshipComponent } from './components/node-relationship-display.component';
import { ProgressDialogComponent } from './components/dialog/progress-dialog.component';
import { TooltipComponent } from './components/tooltip.component';
import { SharedDirectivesModule } from './directives/shareddirectives.module';
import { SharedNgrxEffects } from './store/effects';
import { FriendlyDateStrPipe, ScrubHtmlPipe, TruncatePipe } from './pipes';
import { NodeTextStylePipe } from './node-text-style.pipe';
import { OrganismAutocompleteComponent } from './components/organism-autocomplete.component';
import { SharedSearchService } from './services/shared-search.service';
import { SortLegendComponent } from './components/sort-legend.component';
import { ConfirmDialogComponent } from './components/dialog/confirm-dialog.component';
import { FormInputFeedbackComponent } from './components/form/form-input-feedback.component';
import { BackgroundTaskProgressComponent } from './components/background-task-progress.component';
import { FormRowComponent } from './components/form/form-row.component';
import { ModalHeaderComponent } from './components/modal/modal-header.component';
import { ModalBodyComponent } from './components/modal/modal-body.component';
import { ModalFooterComponent } from './components/modal/modal-footer.component';
import { LoadingIndicatorComponent } from './components/loading-indicator.component';
import { ContentProgressComponent } from './components/content-progress.component';
import { ColorChooserComponent } from './components/form/color-chooser.component';
import { PercentInputComponent } from './components/form/percent-input.component';
import { SelectComponent } from './components/form/select.component';
import { ResultsSummaryComponent } from './components/results-summary.component';
import { QuickSearchComponent } from './components/quick-search.component';
import { CollapsibleWindowComponent } from './components/collapsible-window.component';
import { GenericFileUploadComponent } from './components/generic-file-upload/generic-file-upload.component';
import { ModuleErrorComponent } from './components/module-error.component';
import { ModuleProgressComponent } from './components/module-progress.component';
import { CopyLinkDialogComponent } from './components/dialog/copy-link-dialog.component';
import { AnnotationFilterComponent } from './components/annotation-filter/annotation-filter.component';
import { WordCloudAnnotationFilterComponent } from './components/word-cloud-annotation-filter/word-cloud-annotation-filter.component';
import { GenericTableComponent } from './components/table/generic-table.component';
import { AnnotationConfigurationTableComponent } from './components/table/annotation-config-table.component';
import { HighlightTextComponent } from './components/highlight-text.component';
import { AddStatusPipe } from './pipes/add-status.pipe';
import { TermHighlightComponent } from './components/term-highlight.component';
import { ApiService } from './services/api.service';
import { VisJsNetworkComponent } from './components/vis-js-network/vis-js-network.component';
import { PlotlySankeyDiagramComponent } from './components/plotly-sankey-diagram/plotly-sankey-diagram.component';
import { SearchControlComponent } from './components/search-control.component';
import { UserComponent } from './components/user.component';
import { SelectInputComponent } from './components/form/select-input.component';
import { UserSelectComponent } from './components/form/user-select.component';
import { AccountsService } from './services/accounts.service';
import { OrganismComponent } from './components/organism.component';
import { ResultControlComponent } from './components/result-control.component';
import { PaginationComponent } from './components/pagination.component';
import { DATA_TRANSFER_DATA_PROVIDER, DataTransferDataService, } from './services/data-transfer-data.service';
import { GenericDataProvider } from './providers/data-transfer-data/generic-data.provider';
import { HighlightTextService, HIGHLIGHT_TEXT_TAG_HANDLER, } from './services/highlight-text.service';
import { AnnotationTagHandler } from './providers/highlight-text/annotation-tag.provider';
import { HighlightTagHandler } from './providers/highlight-text/highlight-tag.provider';
import { SessionStorageService } from './services/session-storage.service';
import { TreeViewComponent } from './components/tree-view/tree-view.component';
import { ObjectExplorerComponent } from './components/object-explorer/object-explorer.component';
import { ObjectPathComponent } from './components/object-path/object-path.component';
import { ObjectMenuComponent } from './components/object-menu/object-menu.component';
import { ProjectIconComponent } from './components/project-icon/project-icon.component';
import { ProjectMenuComponent } from './components/project-menu/project-menu.component';
import { ModuleHeaderComponent } from './components/module-header/module-header.component';
import { ModuleMenuComponent } from './components/module-menu/module-menu.component';
import { WarningListComponent } from './components/warning-list/warning-list.component';
import { WarningPillComponent } from './components/warning-pill/warning-pill.component';
import { BaseControlComponent } from './components/base-control.component';

const components = [
  VisJsNetworkComponent,
  PlotlySankeyDiagramComponent,
  AnnotationFilterComponent,
  WordCloudAnnotationFilterComponent,
  MessageDialogComponent,
  ProgressDialogComponent,
  HighlightSnippetComponent,
  LegendComponent,
  NodeRelationshipComponent,
  TooltipComponent,
  SortLegendComponent,
  ConfirmDialogComponent,
  OrganismAutocompleteComponent,
  FormInputFeedbackComponent,
  BackgroundTaskProgressComponent,
  FormRowComponent,
  ModalHeaderComponent,
  ModalBodyComponent,
  ModalFooterComponent,
  ContentProgressComponent,
  LoadingIndicatorComponent,
  ColorChooserComponent,
  PercentInputComponent,
  SelectComponent,
  ResultsSummaryComponent,
  QuickSearchComponent,
  CollapsibleWindowComponent,
  GenericFileUploadComponent,
  ModuleErrorComponent,
  ModuleProgressComponent,
  CopyLinkDialogComponent,
  GenericTableComponent,
  AnnotationConfigurationTableComponent,
  HighlightTextComponent,
  TermHighlightComponent,
  BaseControlComponent,
  SearchControlComponent,
  UserComponent,
  SelectInputComponent,
  UserSelectComponent,
  OrganismComponent,
  ResultControlComponent,
  PaginationComponent,
  LinksPanelComponent,
  TreeViewComponent,
  ObjectExplorerComponent,
  ObjectPathComponent,
  ObjectMenuComponent,
  ModuleMenuComponent,
  ProjectIconComponent,
  ProjectMenuComponent,
  WarningListComponent,
  WarningPillComponent
];

@NgModule({
  entryComponents: [
    MessageDialogComponent,
    ProgressDialogComponent,
    CopyLinkDialogComponent,
    LinksPanelComponent,
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    AngularMaterialModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedDirectivesModule,
    AngularSplitModule.forRoot(),
    DragDropModule,
    EffectsModule.forFeature([SharedNgrxEffects]),
    TextFieldModule,
    NgbModule,
  ],
  declarations: [
    ...components,
    TruncatePipe,
    FriendlyDateStrPipe,
    NodeTextStylePipe,
    ScrubHtmlPipe,
    AddStatusPipe,
    ModuleHeaderComponent,
  ],
  providers: [
    ApiService,
    TruncatePipe,
    SharedNgrxEffects,
    SharedSearchService,
    SessionStorageService,
    ApiService,
    AccountsService,
    DataTransferDataService,
    GenericDataProvider,
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: GenericDataProvider,
      multi: true,
    },
    HighlightTextService,
    {
      provide: HIGHLIGHT_TEXT_TAG_HANDLER,
      useClass: AnnotationTagHandler,
      multi: true,
    },
    {
      provide: HIGHLIGHT_TEXT_TAG_HANDLER,
      useClass: HighlightTagHandler,
      multi: true,
    },
  ],
  // exported modules are visible to modules that import this one
  exports: [
    // Modules
    CommonModule,
    HttpClientModule,
    AngularMaterialModule,
    FlexLayoutModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SharedDirectivesModule,
    AngularSplitModule,
    DragDropModule,
    TextFieldModule,
    // Components
    ...components,
    TruncatePipe,
    ScrubHtmlPipe,
    FriendlyDateStrPipe,
    NodeTextStylePipe,
    NgbModule,
    AddStatusPipe,
    ModuleHeaderComponent,
  ],
})
export class SharedModule {
}
