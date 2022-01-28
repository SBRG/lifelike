import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AdminPanelComponent } from 'app/admin/components/admin-panel.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization/visualization.component';
import { GraphSearchComponent } from 'app/search/components/graph-search.component';
import { ObjectBrowserComponent } from 'app/file-browser/components/object-browser.component';
import { LoginComponent } from 'app/auth/components/login.component';
import { DashboardComponent } from 'app/dashboard.component';
import { AdminGuard } from 'app/admin/services/admin-guard.service';
import { AuthGuard } from 'app/auth/guards/auth-guard.service';
import { LoginGuard } from 'app/auth/guards/login-guard.service';
import { FileViewComponent } from 'app/pdf-viewer/components/file-view.component';
import { UserSettingsComponent } from 'app/users/components/user-settings.component';
import { KgStatisticsComponent } from 'app/kg-statistics.component';
import { TermsOfServiceComponent } from 'app/users/components/terms-of-service.component';
import { WorkspaceComponent } from 'app/workspace.component';
import { UnloadConfirmationGuard } from 'app/shared/guards/UnloadConfirmation.guard';
import { MapEditorComponent } from 'app/drawing-tool/components/map-editor/map-editor.component';
import { MapViewComponent } from 'app/drawing-tool/components/map-view.component';
import { CommunityBrowserComponent } from 'app/file-browser/components/community-browser.component';
import { BrowserComponent } from 'app/file-browser/components/browser/browser.component';
import { ContentSearchComponent } from 'app/search/components/content-search.component';
import { ObjectNavigatorComponent } from 'app/file-navigator/components/object-navigator.component';
import { EnrichmentTableViewerComponent } from 'app/enrichment/components/table/enrichment-table-viewer.component';
import { EnrichmentVisualisationViewerComponent } from 'app/enrichment/components/visualisation/enrichment-visualisation-viewer.component';
import { BiocViewComponent } from 'app/bioc-viewer/components/bioc-view.component';
import { ObjectViewerComponent } from 'app/file-browser/components/object-viewer.component';
import { SankeyViewComponent } from 'app/sankey-viewer/components/sankey-view.component';
import { TraceViewComponent } from 'app/trace-viewer/components/trace-view.component';
import { SankeyManyToManyViewComponent } from 'app/sankey-many-to-many-viewer/components/sankey-view.component';

// TODO: Add an unprotected home page
const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Dashboard',
      fontAwesomeIcon: 'home',
    },
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Dashboard',
      fontAwesomeIcon: 'home',
    },
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [LoginGuard],
    data: {
      title: 'Login',
      fontAwesomeIcon: 'sign-in-alt',
    },
  },
  {
    path: 'terms-of-service',
    component: TermsOfServiceComponent,
    data: {
      title: 'Terms of Service',
    },
  },
  {
    path: 'admin',
    component: AdminPanelComponent,
    canActivate: [AdminGuard],
    data: {
      title: 'Administration',
      fontAwesomeIcon: 'cog',
    },
  },
  {
    path: 'users/:user',
    component: UserSettingsComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Profile',
      fontAwesomeIcon: 'user-circle',
    },
  },
  {
    path: 'search/graph',
    component: GraphSearchComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Knowledge Graph',
      fontAwesomeIcon: 'fas fa-chart-network',
    },
  },
  {
    path: 'search/content',
    canActivate: [AuthGuard],
    component: ContentSearchComponent,
    data: {
      title: 'Search',
      fontAwesomeIcon: 'search',
    },
  },
  {
    path: 'projects/:project_name/enrichment-table/:file_id',
    canActivate: [AuthGuard],
    component: EnrichmentTableViewerComponent,
    data: {
      title: 'Enrichment Table',
      fontAwesomeIcon: 'table',
    },
  },
  {
    path: 'projects/:project_name/enrichment-visualisation/:file_id',
    canActivate: [AuthGuard],
    component: EnrichmentVisualisationViewerComponent,
    data: {
      title: 'Statistical Enrichment',
      fontAwesomeIcon: 'chart-bar',
    },
  },
  {
    path: 'projects/:project_name/sankey/:file_id',
    canActivate: [AuthGuard],
    component: SankeyViewComponent,
    data: {
      title: 'Sankey',
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    },
  },
  {
    path: 'projects/:project_name/sankey-many-to-many/:file_id',
    canActivate: [AuthGuard],
    component: SankeyManyToManyViewComponent,
    data: {
      title: 'Sankey',
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    },
  },
  {
    path: 'projects/:project_name/trace/:file_id/:trace_hash',
    canActivate: [AuthGuard],
    component: TraceViewComponent,
    data: {
      title: 'Trace details',
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    },
  },
  {
    path: 'kg-visualizer',
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: '/search',
        pathMatch: 'full',
        canActivate: [AuthGuard],
      },
      {
        path: 'graph',
        component: VisualizationComponent,
        canActivate: [AuthGuard],
        data: {
          title: 'Knowledge Graph',
          fontAwesomeIcon: 'fas fa-chart-network',
        },
      },
    ],
  },
  {
    path: 'workspaces/:space_id',
    component: WorkspaceComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Workbench',
    },
    canDeactivate: [UnloadConfirmationGuard],
  },
  {
    path: 'community',
    component: CommunityBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Community Content',
      fontAwesomeIcon: 'globe',
    },
  },
  {
    path: 'projects',
    component: BrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'File Browser',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'projects/:project_name',
    component: ObjectBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Projects',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'projects/:project_name/folders',
    redirectTo: 'projects/:project_name',
    pathMatch: 'full',
  },
  {
    path: 'projects/:project_name/folders/:dir_id',
    redirectTo: 'folders/:dir_id',
    pathMatch: 'full',
  },
  {
    path: 'folders/:dir_id',
    component: ObjectBrowserComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Projects',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'files/:hash_id',
    component: ObjectViewerComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'File',
      fontAwesomeIcon: 'file',
    },
  },
  {
    path: 'projects/:project_name/files/:file_id',
    component: FileViewComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'PDF Viewer',
      fontAwesomeIcon: 'file-pdf',
    },
  },
  {
    path: 'projects/:project_name/bioc/:file_id',
    component: BiocViewComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'BioC Viewer',
      fontAwesomeIcon: 'file-alt',
    },
  },
  {
    path: 'projects/:project_name/maps/:hash_id',
    canActivate: [AuthGuard],
    component: MapViewComponent,
    data: {
      title: 'Map',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'projects/:project_name/maps/:hash_id/edit',
    component: MapEditorComponent,
    canActivate: [AuthGuard],
    canDeactivate: [UnloadConfirmationGuard],
    data: {
      title: 'Map Editor',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'kg-statistics',
    component: KgStatisticsComponent,
    canActivate: [AuthGuard],
    data: {
      fontAwesomeIcon: 'fas fa-chart-bar',
    },
  },
  {
    path: 'file-navigator/:project_name/:file_id',
    component: ObjectNavigatorComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'File Navigator',
      fontAwesomeIcon: 'fas fa-compass',
    },
  },
  {
    path: 'enrichment-visualisation/:project_name/:file_id',
    component: EnrichmentVisualisationViewerComponent,
    canActivate: [AuthGuard],
    data: {
      title: 'Enrichment Visualisation',
      fontAwesomeIcon: 'fas chart-bar',
    },
  },
  // Old links
  {path: 'file-browser', redirectTo: 'projects', pathMatch: 'full'},
  {path: 'pdf-viewer/:file_id', redirectTo: 'projects/beta-project/files/:file_id', pathMatch: 'full'},
  {path: 'dt/map', redirectTo: 'projects', pathMatch: 'full'},
  {path: 'dt/map/:hash_id', redirectTo: 'projects/beta-project/maps/maps/:hash_id', pathMatch: 'full'},
  {path: 'dt/map/edit/:hash_id', redirectTo: 'projects/beta-project/maps/:hash_id/edit', pathMatch: 'full'},
  {path: 'neo4j-upload', redirectTo: 'kg-visualizer/upload', pathMatch: 'full'},
  {path: 'neo4j-visualizer', redirectTo: 'kg-visualizer', pathMatch: 'full'},
  {path: 'search', redirectTo: 'search/graph', pathMatch: 'full'},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {
}
