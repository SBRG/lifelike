import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';

import { RouteSearchComponent } from './route-search.component';

describe('RouteSearchComponent', () => {
  let component: RouteSearchComponent;
  let fixture: ComponentFixture<RouteSearchComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        RootStoreModule
      ],
      declarations: [ RouteSearchComponent ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(RouteSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
