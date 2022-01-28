import { Injectable } from '@angular/core';

import { TagHandler } from '../../services/highlight-text.service';

@Injectable()
export class HighlightTagHandler extends TagHandler {
  tagName = 'highlight';

  start(element: Element): string {
    return `<span class="highlight-term">`;
  }

  end(element: Element): string {
    return `</span>`;
  }
}
