import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';

import {SharedModule} from 'app/shared/shared.module';

import {WordCloudComponent} from './word-cloud.component';

const components = [
  WordCloudComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
  ],
  exports: components,
})
export class WordCloudModule {
}
