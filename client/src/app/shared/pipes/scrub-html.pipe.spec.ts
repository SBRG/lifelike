import { inject, TestBed } from '@angular/core/testing';
import { BrowserModule, DomSanitizer } from '@angular/platform-browser';

import { configureTestSuite } from 'ng-bullet';

import { ScrubHtmlPipe } from './scrub-html.pipe';

describe('ScrubHtmlPipe', () => {
  configureTestSuite(() => {
    TestBed.configureTestingModule({
      imports: [
        BrowserModule
      ]
    });
  });

  it('create an instance', inject([DomSanitizer], (domSanitizer: DomSanitizer) => {
    const pipe = new ScrubHtmlPipe(domSanitizer);
    expect(pipe).toBeTruthy();
  }));
});
