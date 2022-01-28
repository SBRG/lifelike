import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { escape, escapeRegExp, isNil } from 'lodash-es';

import { FindOptions } from 'app/shared/utils/find';

@Component({
  selector: 'app-term-highlight',
  templateUrl: 'term-highlight.component.html',
})
export class TermHighlightComponent implements OnChanges {
  @Input() text = '';
  @Input() highlightTerms: string[] = [];
  @Input() highlightOptions: FindOptions = {};
  highlight: string;

  ngOnChanges(changes: SimpleChanges) {
    if ('highlightTerms' in changes || 'text' in changes) {
      if (!isNil(this.text) && !isNil(this.highlightTerms) && this.highlightTerms.length > 0) {
        const phrasePatterns = this.highlightTerms.map(
          phrase => escapeRegExp(phrase)
            .replace(/ +/g, ' +')
            .replace(/(\\\*)/g, '\\w*')
            .replace(/(\\\?)/g, '\\w?'),
        ).join('|');
        const pattern = this.highlightOptions.wholeWord ? `\\b(${phrasePatterns})\\b` : `(${phrasePatterns})`;
        const regex = new RegExp(pattern, 'gi');
        this.highlight = '<snippet>' + escape(this.text)
          .replace(regex, '<highlight>$1</highlight>') + '</snippet>';
      } else {
        this.highlight = null;
      }
    }
  }
}
