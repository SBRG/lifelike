import { Component, Input } from '@angular/core';

import { VisNode } from 'app/interfaces';
import {
  AssociatedType,
  AssociatedTypeEntry,
  NewNodePairSnippetsPageRequest,
  AssociatedTypeSnippetCountRequest,
  NodeDisplayInfo,
  SidenavSnippetData,
  SidenavTypeEntity,
} from 'app/interfaces/visualization.interface';
import { SNIPPET_PAGE_LIMIT } from 'app/shared/constants';
import { VisualizationService } from 'app/visualization/services/visualization.service';


@Component({
    selector: 'app-sidenav-type-view',
    templateUrl: './sidenav-type-view.component.html',
    styleUrls: ['./sidenav-type-view.component.scss']
})
export class SidenavTypeViewComponent {
  @Input() legend: Map<string, string[]>;
  @Input() set nodeEntity(entity: SidenavTypeEntity) {
    this.updateNodeEntity(entity);
  }

  node: VisNode;
  connectedNodes: VisNode[];
  associatedType = AssociatedType;
  typeEntries: AssociatedTypeEntry[];
  color: string;
  type: AssociatedType;

  selectedRowSnippetTotal: number;
  selectedRowSnippetData: SidenavSnippetData[];
  queryData: any;

  loading = true;
  showingEntityTable = true;
  newSnippetDisplayEntity = true;

  error: Error;

  constructor(private visualizationService: VisualizationService) {}

  returnToEntityList() {
    this.showingEntityTable = true;
  }

  updateNodeEntity(nodeEntity: SidenavTypeEntity) {
    this.loading = true;
    this.node = nodeEntity.sourceNode;
    this.connectedNodes = nodeEntity.connectedNodes;
    this.type = AssociatedType[nodeEntity.type];

    const request: AssociatedTypeSnippetCountRequest = {
      source_node: this.node.id,
      associated_nodes: this.connectedNodes.map(node => node.id),
    };
    this.color = this.legend.get(this.type)[0];
    this.visualizationService.getAssociatedTypeSnippetCount(request).subscribe(
      (associatedTypes) => {
        this.typeEntries = [];
        const max = associatedTypes.length > 0 ? associatedTypes[0].snippetCount : 0;
        associatedTypes.forEach(associatedType => {
          const entry: AssociatedTypeEntry = {
            id: associatedType.nodeId,
            name: associatedType.name,
            count: associatedType.snippetCount,
            percentage: (associatedType.snippetCount / max) * 100,
          };
          this.typeEntries.push(entry);
        });
        this.loading = false;
      },
      (error) => {
        this.loading = false;
        this.error = error;
      }
    );
  }

  getSnippetsForNewEntity(entry: AssociatedTypeEntry) {
    this.showingEntityTable = false;
    this.loading = true;
    this.newSnippetDisplayEntity = true;

    this.getSnippets(this.node.id, entry.id, SNIPPET_PAGE_LIMIT, 1);
  }

  getNewPageOfSnippets(newPageRequest: NewNodePairSnippetsPageRequest) {
    this.newSnippetDisplayEntity = false;
    this.getSnippets(
      newPageRequest.queryData.node1Id,
      newPageRequest.queryData.node2Id,
      newPageRequest.limit,
      newPageRequest.page
    );
  }

  getSnippets(node1Id: number, node2Id: number, limit: number, page: number) {
    this.visualizationService.getSnippetsForNodePair(
      node1Id,
      node2Id,
      page,
      limit
    ).subscribe(
      (result) => {
        this.queryData = result.queryData;
        this.selectedRowSnippetTotal = result.totalResults;
        this.selectedRowSnippetData = result.snippetData.map(row => {
          let fromNode: VisNode;
          let toNode: VisNode;
          if (row.fromNodeId === this.node.id) {
            fromNode = this.node;
            toNode = this.connectedNodes.find(node => node.id === row.toNodeId);
          } else {
            fromNode = this.connectedNodes.find(node => node.id === row.fromNodeId);
            toNode = this.node;
          }

          return {
            from: {
              primaryLabel: fromNode.primaryLabel,
              displayName: fromNode.displayName,
              url: fromNode.entityUrl,
            } as NodeDisplayInfo,
            to: {
              primaryLabel: toNode.primaryLabel,
              displayName: toNode.displayName,
              url: toNode.entityUrl,
            } as NodeDisplayInfo,
            association: row.association,
            snippets: row.snippets,
          } as SidenavSnippetData;
        });
        this.loading = false;
      },
      (error) => {
        this.loading = false;
        this.error = error;
      }
    );
  }
}
