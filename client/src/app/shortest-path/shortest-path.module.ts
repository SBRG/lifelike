import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { ShortestPathComponent } from './containers/shortest-path.component';
import { RouteSearchComponent } from './containers/route-search.component';
import { RouteBuilderComponent } from './components/route-builder.component';
import { RouteDisplayComponent } from './components/route-display.component';

const components = [
    ShortestPathComponent,
    RouteSearchComponent,
    RouteBuilderComponent,
    RouteDisplayComponent,
];

@NgModule({
  declarations: [...components],
  imports: [
    CommonModule,
    SharedModule,
  ]
})
export class ShortestPathModule { }
