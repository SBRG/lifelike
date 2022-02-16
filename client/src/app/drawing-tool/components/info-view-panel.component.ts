import { Component, Input } from '@angular/core';

import { InternalSearchService } from 'app/shared/services/internal-search.service';
import { SearchType } from 'app/search/shared';

import { GraphEntity, GraphEntityType, UniversalGraphEdge, UniversalGraphNode } from '../services/interfaces';

@Component({
  selector: 'app-info-view-panel',
  templateUrl: './info-view-panel.component.html',
})
export class InfoViewPanelComponent {

  @Input() selected: GraphEntity | undefined;

  constructor(protected readonly internalSearch: InternalSearchService) {
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
    return this.internalSearch.visualizer_tmp_fix(node.display_name, {
      entities: [node.label]
    });
  }

  searchMapNodeInContent(node, type: SearchType | string) {
    return this.internalSearch.fileContents(node.display_name, {types: [type]});
  }
}
