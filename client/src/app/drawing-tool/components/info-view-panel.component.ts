import { Component, Input } from '@angular/core';

import { WorkspaceManager } from 'app/shared/workspace-manager';

import { GraphEntity, GraphEntityType, UniversalGraphEdge, UniversalGraphNode } from '../services/interfaces';

@Component({
  selector: 'app-info-view-panel',
  templateUrl: './info-view-panel.component.html',
})
export class InfoViewPanelComponent {

  @Input() selected: GraphEntity | undefined;

  constructor(protected readonly workspaceManager: WorkspaceManager) {
  }

  get isNode() {
    return this.selected.type === GraphEntityType.Node;
  }

  get name(): string {
    if (this.selected.type === GraphEntityType.Node) {
      const node = this.selected.entity as UniversalGraphNode;
      return node.display_name;
    } else if (this.selected.type === GraphEntityType.Edge) {
      const edge = this.selected.entity as UniversalGraphEdge;
      return edge.label;
    } else {
      return '?unknown entity type?';
    }
  }

  searchMapNodeInVisualizer(node) {
    // TODO: This is a temp fix to make searching compoounds/species easier. Sometime in the future it's expected that these types will be
    // squashed down into a single type.
    let entityType = node.label;
    let organism = '';

    if (entityType === 'compound') {
      entityType = 'chemical';
    } else if (entityType === 'species') {
      entityType = 'taxonomy';
    // TODO: Temp change to allow users to quickly find genes. We will likely remove this once entity IDs are included in the node metadata.
    } else if (entityType === 'gene') {
      organism = '9606';
    }

    this.workspaceManager.navigate(['/search'], {
      queryParams: {
        q: node.display_name,
        page: 1,
        entities: entityType,
        domains: '',
        organism
      },
      sideBySide: true,
      newTab: true,
    });
  }

  searchMapNodeInContent(node, types: string) {
    this.workspaceManager.navigate(['/search/content'], {
      queryParams: {
        q: `"${node.display_name}"`,
        types,
        limit: 20,
        page: 1
      },
      sideBySide: true,
      newTab: true,
    });
  }
}
