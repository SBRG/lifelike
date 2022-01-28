import { Component, Input, OnChanges } from '@angular/core';

import { cloneDeep } from 'lodash-es';

import { Hyperlink } from 'app/drawing-tool/services/interfaces';

import { SEARCH_LINKS } from '../links';

@Component({
  selector: 'app-quick-search',
  templateUrl: './quick-search.component.html',
})
export class QuickSearchComponent implements OnChanges {
  @Input() query: string | undefined;
  @Input() links: Hyperlink[] | undefined;
  @Input() linkTemplates: readonly Hyperlink[] = cloneDeep(SEARCH_LINKS);
  @Input() normalizeDomains = true;

  generated = false;
  shownLinks: Hyperlink[] = [];

  ngOnChanges() {
    if (this.links != null && this.links.length) {
      // links should be sorted in the order that they appear in SEARCH_LINKS
      const sortOrder = SEARCH_LINKS.map(link => link.domain.toLowerCase());
      this.shownLinks = this.links.sort((linkA, linkB) => sortOrder.indexOf(linkA.domain) - sortOrder.indexOf(linkB.domain));
      this.generated = false;
      if (this.normalizeDomains) {
        const normalizedMapping = new Map<string, string>();
        for (const link of this.linkTemplates) {
          normalizedMapping.set(link.domain.toLowerCase(), link.domain);
        }
        for (const link of this.shownLinks) {
          const normalized = normalizedMapping.get(link.domain);
          if (normalized != null) {
            link.domain = normalized;
          }
        }
      }
    } else if (this.query != null) {
      this.shownLinks = this.linkTemplates.map(link => ({
        domain: link.domain,
        url: link.url.replace('%s', encodeURIComponent(this.query))
      }));
      this.generated = true;
    } else {
      this.shownLinks = [];
      this.generated = true;
    }
  }
}
