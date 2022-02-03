import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';
import { MockComponents } from 'ng-mocks';

import { PlotlySankeyDiagramComponent } from 'app/shared/components/plotly-sankey-diagram/plotly-sankey-diagram.component';
import { VisJsNetworkComponent } from 'app/shared/components/vis-js-network/vis-js-network.component';

import { RouteDisplayComponent } from './route-display.component';

describe('RouteDisplayComponent', () => {
  let component: RouteDisplayComponent;
  let fixture: ComponentFixture<RouteDisplayComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [
        RouteDisplayComponent,
        MockComponents(
          PlotlySankeyDiagramComponent,
          VisJsNetworkComponent
        )
      ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RouteDisplayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
