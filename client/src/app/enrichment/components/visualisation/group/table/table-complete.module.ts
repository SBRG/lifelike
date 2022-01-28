import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { NgbModule } from '@ng-bootstrap/ng-bootstrap';

import { SortableTableHeaderDirective } from 'app/shared/directives/table-sortable-header.directive';

import { TableCompleteComponent } from './table-complete.component';
import { LinkModule } from '../../components/link/link.module';

@NgModule({
  imports: [
    BrowserModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LinkModule,
    NgbModule
  ],
  declarations: [TableCompleteComponent, SortableTableHeaderDirective],
  exports: [TableCompleteComponent],
  bootstrap: [TableCompleteComponent]
})
export class TableCompleteComponentModule {}
