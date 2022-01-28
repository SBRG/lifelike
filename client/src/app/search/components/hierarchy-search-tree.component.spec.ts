import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';
import { Subject } from 'rxjs';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { HierarchySearchTreeComponent } from './hierarchy-search-tree.component';

describe('HierarchySearchTreeComponent', () => {
  let component: HierarchySearchTreeComponent;
  let fixture: ComponentFixture<HierarchySearchTreeComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        RootStoreModule,
        SharedModule,
        BrowserAnimationsModule,
      ],
      declarations: [ HierarchySearchTreeComponent ],
      providers: []
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(HierarchySearchTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
