import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AdminPanelComponent } from 'app/admin/components/admin-panel.component';
import { VisualizationComponent } from 'app/visualization/containers/visualization/visualization.component';
import { GraphSearchComponent } from 'app/search/components/graph-search.component';
import { ObjectBrowserComponent } from 'app/file-browser/components/object-browser.component';
import { LoginComponent } from 'app/auth/components/login.component';
import { DashboardComponent } from 'app/dashboard.component';
import { AdminGuard } from 'app/admin/services/admin-guard.service';
import { LoginGuard } from 'app/auth/guards/login-guard.service';
import { LifelikeAuthGuard } from 'app/auth/guards/auth-guard.service';
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
import { ShortestPathComponent } from 'app/shortest-path/containers/shortest-path.component';
import { EnrichmentTableViewerComponent } from 'app/enrichment/components/table/enrichment-table-viewer.component';
import { EnrichmentVisualisationViewerComponent } from 'app/enrichment/components/visualisation/enrichment-visualisation-viewer.component';
import { BiocViewComponent } from 'app/bioc-viewer/components/bioc-view.component';
import { ObjectViewerComponent } from 'app/file-browser/components/object-viewer.component';
import { SankeyViewComponent } from 'app/sankey-viewer/components/sankey-view.component';
import { TraceViewComponent } from 'app/trace-viewer/components/trace-view.component';
import { SankeyManyToManyViewComponent } from 'app/sankey-many-to-many-viewer/components/sankey-view.component';
import { CopyrightInfringementFormComponent } from 'app/reports/components/copyright-infringement-form.component';
import { CookiePolicyComponent } from 'app/policies/components/cookie-policy.component';
import { CopyrightInfringementPolicyComponent } from 'app/policies/components/copyright-infringement-policy.component';
import { PrivacyPolicyComponent } from 'app/policies/components/privacy-policy.component';
import { TermsAndConditionsComponent } from 'app/policies/components/terms-and-conditions.component';


const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    data: {
      title: 'Dashboard',
      fontAwesomeIcon: 'home',
    },
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
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
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'Profile',
      fontAwesomeIcon: 'user-circle',
    },
  },
  {
    path: 'search/graph',
    component: GraphSearchComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'Knowledge Graph',
      fontAwesomeIcon: 'fas fa-chart-network',
    },
  },
  {
    path: 'search/content',
    canActivate: [LifelikeAuthGuard],
    component: ContentSearchComponent,
    data: {
      title: 'Search',
      fontAwesomeIcon: 'search',
    },
  },
  {
    path: 'pathway-browser-prototype',
    canActivate: [LifelikeAuthGuard],
    component: ShortestPathComponent,
  },
  {
    path: 'projects/:project_name/enrichment-table/:file_id',
    canActivate: [LifelikeAuthGuard],
    component: EnrichmentTableViewerComponent,
    data: {
      title: 'Enrichment Table',
      fontAwesomeIcon: 'table',
    },
  },
  {
    path: 'projects/:project_name/enrichment-visualisation/:file_id',
    canActivate: [LifelikeAuthGuard],
    component: EnrichmentVisualisationViewerComponent,
    data: {
      title: 'Statistical Enrichment',
      fontAwesomeIcon: 'chart-bar',
    },
  },
  {
    path: 'projects/:project_name/sankey/:file_id',
    canActivate: [LifelikeAuthGuard],
    component: SankeyViewComponent,
    data: {
      title: 'Sankey',
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    },
  },
  {
    path: 'projects/:project_name/sankey-many-to-many/:file_id',
    canActivate: [LifelikeAuthGuard],
    component: SankeyManyToManyViewComponent,
    data: {
      title: 'Sankey',
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    },
  },
  {
    path: 'projects/:project_name/trace/:file_id/:trace_hash',
    canActivate: [LifelikeAuthGuard],
    component: TraceViewComponent,
    data: {
      title: 'Trace details',
      fontAwesomeIcon: 'fak fa-diagram-sankey-solid',
    },
  },
  {
    path: 'kg-visualizer',
    canActivate: [LifelikeAuthGuard],
    children: [
      {
        path: '',
        redirectTo: '/search',
        pathMatch: 'full',
        canActivate: [LifelikeAuthGuard],
      },
      {
        path: 'graph',
        component: VisualizationComponent,
        canActivate: [LifelikeAuthGuard],
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
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'Workbench',
    },
    canDeactivate: [UnloadConfirmationGuard],
  },
  {
    path: 'community',
    component: CommunityBrowserComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'Community Content',
      fontAwesomeIcon: 'globe',
    },
  },
  {
    path: 'projects',
    component: BrowserComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'File Browser',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'projects/:project_name',
    component: ObjectBrowserComponent,
    canActivate: [LifelikeAuthGuard],
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
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'Projects',
      fontAwesomeIcon: 'layer-group',
    },
  },
  {
    path: 'files/:hash_id',
    component: ObjectViewerComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'File',
      fontAwesomeIcon: 'file',
    },
  },
  {
    path: 'projects/:project_name/files/:file_id',
    component: FileViewComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'PDF Viewer',
      fontAwesomeIcon: 'file-pdf',
    },
  },
  {
    path: 'projects/:project_name/bioc/:file_id',
    component: BiocViewComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'BioC Viewer',
      fontAwesomeIcon: 'file-alt',
    },
  },
  {
    path: 'projects/:project_name/maps/:hash_id',
    canActivate: [LifelikeAuthGuard],
    component: MapViewComponent,
    data: {
      title: 'Map',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'projects/:project_name/maps/:hash_id/edit',
    component: MapEditorComponent,
    canActivate: [LifelikeAuthGuard],
    canDeactivate: [UnloadConfirmationGuard],
    data: {
      title: 'Map Editor',
      fontAwesomeIcon: 'project-diagram',
    },
  },
  {
    path: 'kg-statistics',
    component: KgStatisticsComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      fontAwesomeIcon: 'fas fa-chart-bar',
    },
  },
  {
    path: 'file-navigator/:project_name/:file_id',
    component: ObjectNavigatorComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'File Navigator',
      fontAwesomeIcon: 'fas fa-compass',
    },
  },
  {
    path: 'enrichment-visualisation/:project_name/:file_id',
    component: EnrichmentVisualisationViewerComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'Enrichment Visualisation',
      fontAwesomeIcon: 'fas chart-bar',
    },
  },
  {
    path: 'terms-and-conditions',
    component: TermsAndConditionsComponent,
    data: {
      title: 'Terms and Conditions',
      fontAwesomeIcon: 'fas fa-file-alt',
    },
  },
  {
    path: 'privacy-policy',
    component: PrivacyPolicyComponent,
    data: {
      title: 'Privacy Policy',
      fontAwesomeIcon: 'fas fa-file-alt',
    },
  },
  {
    path: 'cookie-policy',
    component: CookiePolicyComponent,
    data: {
      title: 'Cookie Policy',
      fontAwesomeIcon: 'fas fa-file-alt',
    },
  },
  {
    path: 'copyright-infringement-policy',
    component: CopyrightInfringementPolicyComponent,
    data: {
      title: 'Copyright Infringement Policy',
      fontAwesomeIcon: 'fas fa-file-alt',
    },
  },
  {
    path: 'report/copyright-infringement/form',
    component: CopyrightInfringementFormComponent,
    canActivate: [LifelikeAuthGuard],
    data: {
      title: 'Copyright Infringement Claim Request Form',
      fontAwesomeIcon: 'fas fa-copyright',
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
