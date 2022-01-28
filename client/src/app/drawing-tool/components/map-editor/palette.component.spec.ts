import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';

import { DrawingToolModule } from '../../drawing-tool.module';
import { PaletteComponent } from './palette.component';

describe('PaletteComponent', () => {
    let component: PaletteComponent;
    let fixture: ComponentFixture<PaletteComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
              DrawingToolModule,
              RootStoreModule
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(PaletteComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
