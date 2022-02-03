import { NgModule } from '@angular/core';

import { EffectsModule } from '@ngrx/effects';
import { StoreModule } from '@ngrx/store';

import { SharedModule } from 'app/shared/shared.module';

import { UserFileImportComponent } from './components/user-file-import.component';
import { UserFileImportColumnDelimiterRowComponent } from './components/user-file-import-column-delimiter-row.component';
import { UserFileImportColumnMappingComponent } from './components/user-file-import-column-mapping.component';
import {
    UserFileImportColumnNodePropertyMappingRowComponent } from './components/user-file-import-column-node-property-mapping-row.component';
import {
    UserFileImportColumnRelationshipMapperComponent } from './components/user-file-import-column-relationship-mapping.component';
import {
    UserFileImportColumnRelationshipMappingRowComponent } from './components/user-file-import-column-relationship-mapping-row.component';
import {
    UserFileImportExistingColumnMappingRowComponent } from './components/user-file-import-existing-column-mapping-row.component';
import {
    UserFileImportNewColumnMappingRowComponent } from './components/user-file-import-new-column-mapping-row.component';
import { UserFileImportService } from './services/user-file-import.service';
import { reducer } from './store/reducer';
import { UserFileImportEffects } from './store/effects';


const components = [
    UserFileImportComponent,
    UserFileImportColumnDelimiterRowComponent,
    UserFileImportColumnMappingComponent,
    UserFileImportColumnNodePropertyMappingRowComponent,
    UserFileImportColumnRelationshipMapperComponent,
    UserFileImportColumnRelationshipMappingRowComponent,
    UserFileImportNewColumnMappingRowComponent,
    UserFileImportExistingColumnMappingRowComponent,
];

@NgModule({
    imports: [
        SharedModule,
        EffectsModule.forFeature([UserFileImportEffects]),
        StoreModule.forFeature('user-file-import', reducer),
    ],
    exports: components,
    declarations: components,
    providers: [
        UserFileImportEffects,
        UserFileImportService,
    ],
})
export class UserFileImportModule {}
