import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CopyrightInfringementPolicyComponent } from './copyright-infringement-policy.component';

describe('CopyrightInfringementPolicyComponent', () => {
  let component: CopyrightInfringementPolicyComponent;
  let fixture: ComponentFixture<CopyrightInfringementPolicyComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CopyrightInfringementPolicyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CopyrightInfringementPolicyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
