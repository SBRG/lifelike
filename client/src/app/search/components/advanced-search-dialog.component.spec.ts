
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { configureTestSuite } from 'ng-bullet';
import { MockComponent } from 'ng-mocks';

import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { AdvancedSearchDialogComponent } from './advanced-search-dialog.component';
import { HierarchySearchTreeComponent } from './hierarchy-search-tree.component';
import { ContentSearchService } from '../services/content-search.service';

describe('AdvancedSearchDialogComponent', () => {
  let component: AdvancedSearchDialogComponent;
  let fixture: ComponentFixture<AdvancedSearchDialogComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        RootStoreModule,
        SharedModule,
        BrowserAnimationsModule,
        RouterTestingModule
      ],
      declarations: [
        AdvancedSearchDialogComponent,
        MockComponent(HierarchySearchTreeComponent)
      ],
      providers: [
        ContentSearchService,
        FilesystemService,
        NgbActiveModal,
      ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AdvancedSearchDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
