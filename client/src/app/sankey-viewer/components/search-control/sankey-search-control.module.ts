import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { SankeySearchControlComponent } from './search-control.component';

@NgModule({
  declarations: [
    SankeySearchControlComponent,
  ],
  imports: [
    SharedModule
  ],
  exports: [
    SankeySearchControlComponent
  ],
})
export class SankeySearchControlModule {
}
