import { ErrorHandler, NgModule } from '@angular/core';
import { BrowserModule, Title } from '@angular/platform-browser';

import { ChartsModule } from 'ng2-charts';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { RootStoreModule } from 'app/root-store';
import { AdminModule } from 'app/admin/admin.module';
import { AuthModule } from 'app/auth/auth.module';
import { UserModule } from 'app/users/users.module';
import { AppRoutingModule } from 'app/app-routing.module';
import { AppComponent } from 'app/app.component';
import { UserFileImportModule } from 'app/user-file-import/user-file-import.module';
import { SearchModule } from 'app/search/search.module';
import { SharedModule } from 'app/shared/shared.module';
import { KgStatisticsComponent } from 'app/kg-statistics.component';
import { httpInterceptorProviders } from 'app/shared/http-interceptors';
import { VisualizationModule } from 'app/visualization/visualization.module';
import { DrawingToolModule } from 'app/drawing-tool/drawing-tool.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';
import { WorkspaceComponent } from 'app/workspace.component';
import { WorkspaceOutletComponent } from 'app/workspace-outlet.component';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { UnloadConfirmationGuard } from 'app/shared/guards/UnloadConfirmation.guard';
import { DashboardComponent } from 'app/dashboard.component';
import { KgImportModule } from 'app/kg-import/kg-import.module';
import { AppVersionDialogComponent } from 'app/app-version-dialog.component';
import { FileNavigatorModule } from 'app/file-navigator/file-navigator.module';
import { ShortestPathModule } from 'app/shortest-path/shortest-path.module';
import { PdfViewerLibModule } from 'app/pdf-viewer/pdf-viewer-lib.module';
import { GlobalErrorHandler } from 'app/global-error-handler';
import { EnrichmentTablesModule } from 'app/enrichment/enrichment-tables.module';
import { EnrichmentVisualisationsModule } from 'app/enrichment/enrichment-visualisation.module';
import { BiocViewerLibModule } from 'app/bioc-viewer/bioc-viewer-lib.module';
import { SankeyViewerLibModule } from 'app/sankey-viewer/sankey-viewer-lib.module';
import { TraceViewerLibModule } from 'app/trace-viewer/trace-viewer-lib.module';
import { SankeyManyToManyViewerLibModule } from 'app/sankey-many-to-many-viewer/sankey-viewer-lib.module';
import { FileTypesModule } from 'app/file-types/file-types.module';

@NgModule({
  declarations: [
    AppComponent,
    WorkspaceComponent,
    WorkspaceOutletComponent,
    AppVersionDialogComponent,
    DashboardComponent,
    KgStatisticsComponent,
  ],
  entryComponents: [
    AppVersionDialogComponent,
  ],
  imports: [
    BrowserModule,
    PdfViewerLibModule,
    AdminModule,
    AuthModule,
    SharedModule,
    AppRoutingModule,
    FileTypesModule,
    UserFileImportModule,
    FileBrowserModule,
    VisualizationModule,
    UserModule,
    KgImportModule,
    // ngrx
    RootStoreModule,
    SearchModule,
    ChartsModule,
    DrawingToolModule,
    SankeyViewerLibModule,
    SankeyManyToManyViewerLibModule,
    TraceViewerLibModule,
    NgbModule,
    FileNavigatorModule,
    BiocViewerLibModule,
    EnrichmentVisualisationsModule,
    ShortestPathModule,
    EnrichmentTablesModule,
  ],
  providers: [
    httpInterceptorProviders,
    Title,
    WorkspaceManager,
    UnloadConfirmationGuard,
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandler,
    }
  ],
  exports: [],
  bootstrap: [AppComponent],
})
export class AppModule {
}
