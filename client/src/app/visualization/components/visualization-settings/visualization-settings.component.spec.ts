import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';

import { DEFAULT_CLUSTER_ROWS } from 'app/shared/constants';
import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { VisualizationSettingsComponent } from './visualization-settings.component';

describe('VisualizationSettingsComponent', () => {
    let instance: VisualizationSettingsComponent;
    let fixture: ComponentFixture<VisualizationSettingsComponent>;

    let settingsFormChangesSpy: jasmine.Spy;

    let mockLegend: string[];

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                BrowserAnimationsModule,
            ],
            declarations: [ VisualizationSettingsComponent ]
        });
    });

    beforeEach(() => {
        mockLegend = ['MockNode1', 'MockNode2'];

        fixture = TestBed.createComponent(VisualizationSettingsComponent);
        instance = fixture.componentInstance;
        instance.legendLabels = mockLegend;

        settingsFormChangesSpy = spyOn(instance.settingsFormChanges, 'emit');

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(instance).toBeTruthy();
    });

    it('should setup form and emit to parent on init', () => {
        const maxClusterRowsControl = instance.settingsForm.get('maxClusterShownRows');
        const labelCheckbox1 = instance.settingsForm.get('MockNode1');
        const labelCheckbox2 = instance.settingsForm.get('MockNode2');

        expect(maxClusterRowsControl.value).toEqual(DEFAULT_CLUSTER_ROWS);
        expect(labelCheckbox1.value).toEqual(true);
        expect(labelCheckbox2.value).toEqual(true);

        expect(settingsFormChangesSpy).toHaveBeenCalledTimes(1);
    });

    it('should show the max cluster rows input', () => {
        const maxClusterRowsInputElement = document.getElementById(instance.maxClusterRowsInputId) as HTMLInputElement;
        expect(maxClusterRowsInputElement).toBeTruthy();
        expect(maxClusterRowsInputElement.value).toEqual(DEFAULT_CLUSTER_ROWS.toString());
    });

    it('should show checkboxes for each label provided by the parent', () => {
        const checkboxElements = document.getElementsByClassName('custom-checkbox custom-control');
        expect(checkboxElements.length).toEqual(2);
        expect(checkboxElements[0].textContent.trim()).toEqual('MockNode1');
        expect(checkboxElements[1].textContent.trim()).toEqual('MockNode2');
    });
});
