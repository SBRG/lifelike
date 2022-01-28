import { NgModule } from '@angular/core';

import { SharedModule } from 'app/shared/shared.module';

import { SELinkDirective } from './link.directive';

@NgModule({
  imports: [
    SharedModule,
  ],
  declarations: [SELinkDirective],
  exports: [SELinkDirective]
})
export class LinkModule {}
