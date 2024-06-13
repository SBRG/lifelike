import { ComponentFixture, TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { PolicyViewerComponent } from './policy-viewer.component';

describe('PolicyViewerComponent', () => {
  let component: PolicyViewerComponent;
  let fixture: ComponentFixture<PolicyViewerComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      declarations: [ PolicyViewerComponent ],
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PolicyViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
