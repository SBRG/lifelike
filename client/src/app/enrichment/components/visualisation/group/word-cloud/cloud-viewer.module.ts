import { NgModule } from '@angular/core';

import { WordCloudModule } from 'app/shared/components/word-cloud/word-cloud.module';

import { CloudViewerComponent } from './cloud-viewer.component';

const components = [
  CloudViewerComponent
];

@NgModule({
  declarations: components,
  imports: [
    WordCloudModule
  ],
  exports: components,
})
export class CloudViewerModule {

}
