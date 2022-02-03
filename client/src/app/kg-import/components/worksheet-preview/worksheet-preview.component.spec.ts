import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { WorksheetPreviewComponent } from './worksheet-preview.component';

describe('WorksheetPreviewComponent', () => {
    let component: WorksheetPreviewComponent;
    let fixture: ComponentFixture<WorksheetPreviewComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ WorksheetPreviewComponent ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(WorksheetPreviewComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
