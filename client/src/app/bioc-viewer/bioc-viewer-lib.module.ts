import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlexLayoutModule } from '@angular/flex-layout';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialogModule } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';

import { SharedModule } from 'app/shared/shared.module';
import { FileBrowserModule } from 'app/file-browser/file-browser.module';

import { BiocViewComponent } from './components/bioc-view.component';
import { InfonsComponent } from './components/infons/infons.component';
import { AnnotatedTextComponent } from './components/annotated-text/annotated-text.component';
import { BiocTableViewComponent } from './components/bioc-table-view/bioc-table-view.component';

@NgModule({
  declarations: [
    BiocViewComponent,
    InfonsComponent,
    AnnotatedTextComponent,
    BiocTableViewComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    BrowserAnimationsModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatSidenavModule,
    MatDialogModule,
    MatChipsModule,
    MatSelectModule,
    MatInputModule,
    FlexLayoutModule,
    MatButtonModule,
    MatRadioModule,
    SharedModule,
    FileBrowserModule,
    RouterModule.forRoot([]),
  ],
  exports: [
    BiocViewComponent,
    InfonsComponent,
    AnnotatedTextComponent,
    BiocTableViewComponent
  ],
})
export class BiocViewerLibModule {
}
