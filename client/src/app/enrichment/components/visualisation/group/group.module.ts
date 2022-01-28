import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';
import { WordCloudModule } from 'app/shared/components/word-cloud/word-cloud.module';

import { GroupComponent } from './group.component';
import { ChartModule } from './chart/chart.module';
import { TableCompleteComponentModule } from './table/table-complete.module';
import { ClustergramModule } from './clustergram/clustergram.module';
import { CloudViewerModule } from './word-cloud/cloud-viewer.module';

@NgModule({
  declarations: [
    GroupComponent
  ],
  imports: [
    CommonModule,
    SharedModule,
    ChartModule,
    WordCloudModule,
    TableCompleteComponentModule,
    ClustergramModule,
    CloudViewerModule
  ],
  exports: [
    GroupComponent
  ]
})
export class GroupModule {
}
