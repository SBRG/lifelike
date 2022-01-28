import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { EnrichmentVisualisationViewerComponent } from './components/visualisation/enrichment-visualisation-viewer.component';
import { EnrichmentVisualisationService } from './services/enrichment-visualisation.service';
import { GroupModule } from './components/visualisation/group/group.module';

@NgModule({
  declarations: [
    EnrichmentVisualisationViewerComponent
  ],
  imports: [
    SharedModule,
    FileBrowserModule,
    GroupModule
  ],
  exports: [
    EnrichmentVisualisationViewerComponent
  ],
  providers: [
    EnrichmentVisualisationService
  ],
})
export class EnrichmentVisualisationsModule {
}
