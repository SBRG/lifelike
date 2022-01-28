import { Component, Input } from '@angular/core';

import { ProjectImpl } from 'app/file-browser/models/filesystem-object';
import { ProjectActions } from 'app/file-browser/services/project-actions';

@Component({
  selector: 'app-project-menu',
  templateUrl: './project-menu.component.html',
})
export class ProjectMenuComponent {

  @Input() project: ProjectImpl;
  @Input() nameEntity = false;
  @Input() showTools = true;

  constructor(protected readonly projectActions: ProjectActions) {
  }

  openEditDialog(project: ProjectImpl) {
    this.projectActions.openEditDialog(project);
  }

  openCollaboratorsDialog(project: ProjectImpl) {
    this.projectActions.openCollaboratorsDialog(project);
  }

  openShareDialog(project: ProjectImpl) {
    this.projectActions.openShareDialog(project);
  }
}
