import { NgModule } from '@angular/core';

import { SankeyDetailsPanelModule } from 'app/sankey-viewer/components/details-panel/sankey-details-panel.module';
import { SharedModule } from 'app/shared/shared.module';

import { SankeyManyToManyLinkDetailsComponent } from './link-details.component';
import { SankeyManyToManyDetailsPanelComponent } from './details-panel.component';

@NgModule({
  declarations: [
    SankeyManyToManyLinkDetailsComponent,
    SankeyManyToManyDetailsPanelComponent,
  ],
  imports: [
    SankeyDetailsPanelModule,
    SharedModule
  ],
  exports: [
    SankeyManyToManyDetailsPanelComponent
  ],
})
export class SankeyManyToManyDetailsPanelModule {
}
