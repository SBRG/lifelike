import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { GeneImportConfigComponent } from './gene-import-config.component';

describe('GeneImportConfigComponent', () => {
    let component: GeneImportConfigComponent;
    let fixture: ComponentFixture<GeneImportConfigComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [
                GeneImportConfigComponent,
            ],
            imports: [
                SharedModule,
                RootStoreModule
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(GeneImportConfigComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
