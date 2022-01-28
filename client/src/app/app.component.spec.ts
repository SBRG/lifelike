import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';

import { AppComponent } from 'app/app.component';
import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let instance: AppComponent;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        RootStoreModule,
        SharedModule,
        BrowserAnimationsModule,
      ],
      declarations: [
        AppComponent
      ],
    });
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AppComponent);
    instance = fixture.debugElement.componentInstance;
  });

  it('should create the app', () => {
    expect(fixture).toBeTruthy();
  });
});
