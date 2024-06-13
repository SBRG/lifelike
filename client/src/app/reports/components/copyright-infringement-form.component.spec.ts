import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientModule } from '@angular/common/http';
import { RouterTestingModule } from '@angular/router/testing';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { CopyrightInfringementFormComponent } from './copyright-infringement-form.component';
import { ReportsService } from '../services/reports.service';

describe('CopyrightInfringementFormComponent', () => {
  let component: CopyrightInfringementFormComponent;
  let fixture: ComponentFixture<CopyrightInfringementFormComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientModule,
        RootStoreModule,
        RouterTestingModule,
        SharedModule,
      ],
      declarations: [ CopyrightInfringementFormComponent ],
      providers: [
        ReportsService
      ]
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CopyrightInfringementFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
