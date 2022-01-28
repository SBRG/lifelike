import { Pipe, PipeTransform, SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

@Pipe({
  name: 'scrubHtml'
})
export class ScrubHtmlPipe implements PipeTransform {
  constructor(
    private domSanitizer: DomSanitizer,
  ) {}

  transform(value: string): any {
    return this.domSanitizer.sanitize(SecurityContext.HTML, value);
  }
}
