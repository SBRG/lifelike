import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';

import { BiocTableViewComponent } from './bioc-table-view.component';
import { AnnotatedTextComponent } from '../annotated-text/annotated-text.component';

describe('BiocTableViewComponent', () => {
  let component: BiocTableViewComponent;
  let fixture: ComponentFixture<BiocTableViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ BiocTableViewComponent, AnnotatedTextComponent, NgbTooltip]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(BiocTableViewComponent);
    component = fixture.componentInstance;
    component.passage = {};
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
