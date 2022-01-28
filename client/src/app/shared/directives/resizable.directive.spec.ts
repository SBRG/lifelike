import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HostListener, Component, ElementRef } from '@angular/core';

import { configureTestSuite } from 'ng-bullet';

import { ResizableDirective } from './resizable.directive';

// Simple test component that will not in the actual app
@Component({
  template: '<p id="hello">Testing Directives is awesome!</p>'
})
class TestComponent {
  // clickCount is not necessary but it's used here to verify that the component
  // is actually getting clicked
  clickCount = 0;

  constructor() { }

  // allows us to listen to click events on the main wrapper element of our component
  @HostListener('click')
  onClick() {
    this.clickCount = ++this.clickCount; // increment clickCount
  }
}

describe('ResizableDirective', () => {
  let component: TestComponent;
  let fixture: ComponentFixture<TestComponent>;

  configureTestSuite(() => {
    TestBed.configureTestingModule({
        declarations: [
          TestComponent
        ]
    });

    fixture = TestBed.createComponent(TestComponent);
    component = fixture.componentInstance;
  });

  it('should create an instance', () => {
    const debugEl = fixture.debugElement.nativeElement;

    const directive = new ResizableDirective(
      debugEl
    );
    expect(directive).toBeTruthy();
  });
});
