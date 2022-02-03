import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { SharedModule } from 'app/shared/shared.module';

import { GeneImportConfigComponent } from './components/gene-import-config/gene-import-config.component';
import { WorksheetPreviewComponent } from './components/worksheet-preview/worksheet-preview.component';
import { GeneImportWizardComponent } from './containers/gene-import-wizard/gene-import-wizard.component';
import { KgImportWizardComponent } from './containers/kg-import-wizard/kg-import-wizard.component';

const components = [
    GeneImportConfigComponent,
    GeneImportWizardComponent,
    KgImportWizardComponent,
    WorksheetPreviewComponent,
];

@NgModule({
  declarations: components,
  imports: [
    CommonModule,
    SharedModule
  ]
})
export class KgImportModule { }
