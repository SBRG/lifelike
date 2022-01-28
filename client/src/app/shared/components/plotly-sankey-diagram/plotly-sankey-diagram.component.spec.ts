import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';
import { MockComponents } from 'ng-mocks';

import { LegendComponent } from '../legend.component';
import { PlotlySankeyDiagramComponent } from './plotly-sankey-diagram.component';

describe('PlotlySankeyDiagramComponent', () => {
  let component: PlotlySankeyDiagramComponent;
  let fixture: ComponentFixture<PlotlySankeyDiagramComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [
        PlotlySankeyDiagramComponent,
        MockComponents(
          LegendComponent
        ),
      ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlotlySankeyDiagramComponent);
    component = fixture.componentInstance;

    // For now, replace ngAfterViewInit with an empty mock. This is to avoid errors related to declaring `Plotly` as a global const.
    spyOn(component, 'ngAfterViewInit').and.callFake(() => {});

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
