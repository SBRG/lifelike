import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import {SortingAlgorithmsComponent} from './sorting/sorting-algorithms.component';
import { WordCloudComponent } from './components/word-cloud.component';

const components = [
  WordCloudComponent,
  SortingAlgorithmsComponent,
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
