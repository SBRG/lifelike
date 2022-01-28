import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

import { SharedModule } from 'app/shared/shared.module';
import { ConfirmDialogComponent } from 'app/shared/components/dialog/confirm-dialog.component';
import { DATA_TRANSFER_DATA_PROVIDER } from 'app/shared/services/data-transfer-data.service';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { MapEditorComponent } from './components/map-editor/map-editor.component';
import { PaletteComponent } from './components/map-editor/palette.component';
import { InfoPanelComponent } from './components/map-editor/info-panel.component';
import { MapViewComponent } from './components/map-view.component';
import { NodeFormComponent } from './components/map-editor/node-form.component';
import { EdgeFormComponent } from './components/map-editor/edge-form.component';
import { MapRestoreDialogComponent } from './components/map-restore-dialog.component';
import { MapComponent } from './components/map.component';
import { InfoViewPanelComponent } from './components/info-view-panel.component';
import { GraphEntityDataProvider } from './providers/graph-entity-data.provider';
import { LinkEditDialogComponent } from './components/map-editor/dialog/link-edit-dialog.component';
import { MapImageProviderService } from './services/map-image-provider.service';

@NgModule({
  declarations: [
    MapEditorComponent,
    PaletteComponent,
    InfoPanelComponent,
    MapComponent,
    MapViewComponent,
    NodeFormComponent,
    EdgeFormComponent,
    MapRestoreDialogComponent,
    InfoViewPanelComponent,
    LinkEditDialogComponent,
  ],
  entryComponents: [
    ConfirmDialogComponent,
    MapRestoreDialogComponent,
    MapComponent,
    InfoViewPanelComponent,
    LinkEditDialogComponent,
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
  ],
  providers: [
    {
      provide: DATA_TRANSFER_DATA_PROVIDER,
      useClass: GraphEntityDataProvider,
      multi: true,
    },
    MapImageProviderService,
  ],
  exports: [
    RouterModule,
    MapComponent,
  ],
})
export class DrawingToolModule {
}
