import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';

import { TooltipComponent } from './tooltip.component';

describe('TooltipComponent', () => {
    let component: TooltipComponent;
    let fixture: ComponentFixture<TooltipComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            declarations: [ TooltipComponent ],
            imports: [
                BrowserAnimationsModule
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TooltipComponent);
        component = fixture.componentInstance;
        component.tooltipOptions = null;
        component.tooltipSelector = 'mock-element';

        const mockElement = document.createElement('div');
        mockElement.setAttribute('id', 'mock-element');

        // Spy on document.querySelector so we can create a valid tooltip in the component
        // (querySelector is called once in the ngOnInit of the TooltipComponent)
        spyOn(document, 'querySelector').and.returnValue(mockElement);

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
