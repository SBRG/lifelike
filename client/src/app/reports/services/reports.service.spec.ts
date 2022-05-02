import { HttpClientModule } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [ HttpClientModule ]
    });
  });

  beforeEach(() => {
    service = TestBed.inject(ReportsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
