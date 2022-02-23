import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { CopyrightInfringementFormComponent } from './components/copyright-infringement-form.component';


@NgModule({
  declarations: [CopyrightInfringementFormComponent],
  imports: [
    CommonModule,
    SharedModule
  ]
})
export class ReportsModule { }
