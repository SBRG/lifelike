import { Directive, Input, HostBinding } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { map } from 'rxjs/operators';

import { WorkspaceManager } from 'app/shared/workspace-manager';
import { LinkWithoutHrefDirective } from 'app/shared/directives/link.directive';
import { EnrichmentTableViewerComponent } from 'app/enrichment/components/table/enrichment-table-viewer.component';

export const paramsToEnrichmentTableLink = ({project_name, file_id}) => ({
  appLink: [
    '/projects',
    project_name,
    'enrichment-table',
    file_id
  ],
  matchExistingTab: '^/+projects/[^/]+/enrichment-table/' +
    file_id +
    '([?#].*)?'
});

// just coping the patter how it has been implemented for file navigator...
export function triggerSearchOnShouldReplaceTab(text) {
  return component => {
    const enrichmentTableViewerComponent = component as EnrichmentTableViewerComponent;
    enrichmentTableViewerComponent.startTextFind(text);
    return false;
  };
}

/**
 * Implements a version of [LinkWithoutHrefDirective] that automatically resolves path to related
 * enrichment table.
 */
@Directive({
  selector: ':not(a):not(area)[appSELink]'
})
export class SELinkDirective extends LinkWithoutHrefDirective {
  @HostBinding('style.cursor') cursor = 'pointer';

  constructor(workspaceManager: WorkspaceManager, router: Router, route: ActivatedRoute) {
    super(workspaceManager, router, route);
    route.params.pipe(
      map(paramsToEnrichmentTableLink)
    ).subscribe(
      link => Object.assign(this, link)
    );
  }

  @Input() appSELink;
  sideBySide = true;
  newTab = true;

  // @ts-ignore
  get shouldReplaceTab() {
    return triggerSearchOnShouldReplaceTab(this.appSELink);
  }

  appLink;
  matchExistingTab;

  get fragment() {
    return `text=${this.appSELink}`;
  }
}
