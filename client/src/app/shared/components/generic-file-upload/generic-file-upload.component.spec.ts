import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';
import { Subject } from 'rxjs';

import { GenericFileUploadComponent } from './generic-file-upload.component';

describe('GenericFileUploadComponent', () => {
    let component: GenericFileUploadComponent;
    let fixture: ComponentFixture<GenericFileUploadComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ GenericFileUploadComponent ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(GenericFileUploadComponent);
        component = fixture.componentInstance;

        component.accept = 'xlsx';
        component.resetFileInputSubject = new Subject<boolean>();

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
