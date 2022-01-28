import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';
import { MockComponents } from 'ng-mocks';

import { LegendComponent } from './legend.component';
import { CollapsibleWindowComponent } from './collapsible-window.component';

describe('LegendComponent', () => {
    let component: LegendComponent;
    let fixture: ComponentFixture<LegendComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [
              LegendComponent,
              MockComponents(
                CollapsibleWindowComponent
              )
            ],
            imports: [
                BrowserAnimationsModule
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(LegendComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
