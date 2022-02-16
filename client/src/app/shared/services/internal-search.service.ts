import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { WorkspaceManager, WorkspaceNavigationExtras } from 'app/shared/workspace-manager';
import { GraphSearchParameters } from 'app/search/graph-search';
import { getGraphQueryParams, ContentSearchParameters, getContentSearchQueryParams } from 'app/search/utils/search';

@Injectable()
export class InternalSearchService {
  constructor(
    protected readonly workspaceManager: WorkspaceManager,
    protected readonly router: Router
  ) {
  }

  private readonly WORKSPACE_ARGUMENTS: WorkspaceNavigationExtras = {
    sideBySide: true,
    newTab: true,
  };

  getVisualizerLink(query, params = {}) {
    return this.router.createUrlTree(...this.getVisualizerArguments(query, params));
  }

  getFileContentLink(query, params = {}) {
    return this.router.createUrlTree(...this.getFileContentsArguments(query, params));
  }

  getFileContentsArguments(query, params = {}): Parameters<WorkspaceManager['navigate']> {
    return [
      ['/search/content'],
      {
        queryParams: getContentSearchQueryParams({
          limit: 20,
          page: 1,
          ...params,
          q: query
        }),
        ...this.WORKSPACE_ARGUMENTS
      }
    ];
  }

  getVisualizerArguments(query, params = {}): Parameters<WorkspaceManager['navigate']> {
    return [
      ['/search/graph'],
      {
        queryParams: getGraphQueryParams({
          ...params,
          query
        }),
        ...this.WORKSPACE_ARGUMENTS
      }
    ];
  }

  fileContents(query, params = {}) {
    return this.workspaceManager.navigate(...this.getFileContentsArguments(query, params));
  }

  visualizer(query, params = {}) {
    return this.workspaceManager.navigate(...this.getVisualizerArguments(query, params));
  }

  // region Tmp fix for search
  private tmp_visualiser_search_params_fix({entities: [entity] = []}: Partial<GraphSearchParameters>) {
    // TODO: This is a temp fix to make searching compoounds/species easier. Sometime in the future it's expected that these types will be
    // squashed down into a single type.
    switch (entity) {
      case 'compound':
        return {entities: ['chemical']};
      case 'species':
        return {entities: ['taxonomy']};
      case 'gene':
        // TODO: Temp change to allow users to quickly find genes. We will likely remove this once entity IDs are included in the node
        // metadata.
        return {organism: '9606'};
      default:
        return {};
    }
  }

  visualizer_tmp_fix(query, params: Partial<GraphSearchParameters> = {}) {
    // TODO: This is a temp fix to make searching compoounds/species easier. Sometime in the future it's expected that these types will be
    // squashed down into a single type.
    return this.visualizer(query, {
      ...params,
      ...this.tmp_visualiser_search_params_fix(params)
    });
  }

  // endregion
}
