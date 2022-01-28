import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';
import { ClipboardService } from 'app/shared/services/clipboard.service';

import { SankeyComponent } from './sankey.component';

const components = [
  SankeyComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
  ],
  exports: components,
  providers: [ClipboardService]
})
export class SankeyModule {
}
