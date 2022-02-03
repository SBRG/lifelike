import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { KgImportWizardComponent } from './kg-import-wizard.component';

describe('KgImportWizardComponent', () => {
    let component: KgImportWizardComponent;
    let fixture: ComponentFixture<KgImportWizardComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ KgImportWizardComponent ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(KgImportWizardComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
