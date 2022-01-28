import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { ClustergramComponent } from './clustergram.component';
import { LinkModule } from '../../components/link/link.module';

const components = [
  ClustergramComponent
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule,
    LinkModule
  ],
  exports: components,
})
export class ClustergramModule {
}
