import { Injectable } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { BehaviorSubject } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { CopyLinkDialogComponent } from 'app/shared/components/dialog/copy-link-dialog.component';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { Progress } from 'app/interfaces/common-dialog.interface';

import { ProjectsService } from './projects.service';
import { ProjectImpl } from '../models/filesystem-object';
import { ProjectEditDialogComponent, ProjectEditDialogValue } from '../components/dialog/project-edit-dialog.component';
import { ProjectCreateRequest } from '../schema';
import { ProjectCollaboratorsDialogComponent } from '../components/dialog/project-collaborators-dialog.component';

@Injectable()
export class ProjectActions {

  constructor(protected readonly projectService: ProjectsService,
              protected readonly modalService: NgbModal,
              protected readonly messageDialog: MessageDialog,
              protected readonly errorHandler: ErrorHandler,
              protected readonly progressDialog: ProgressDialog) {
  }

  protected createProgressDialog(message: string, title = 'Working...') {
    const progressObservables = [new BehaviorSubject<Progress>(new Progress({
      status: message,
    }))];
    return this.progressDialog.display({
      title,
      progressObservables,
    });
  }

  /**
   * Open a dialog to create a project.
   */
  openCreateDialog(options: CreateDialogOptions = {}): Promise<ProjectImpl> {
    const project = new ProjectImpl();
    const dialogRef = this.modalService.open(ProjectEditDialogComponent);
    dialogRef.componentInstance.title = options.title || 'New Project';
    dialogRef.componentInstance.project = project;
    dialogRef.componentInstance.accept = ((value: ProjectEditDialogValue) => {
      const progressDialogRef = this.createProgressDialog('Creating project...');
      return this.projectService.create({
        ...value.request,
        ...(options.request || {}),
      }).pipe(
        finalize(() => progressDialogRef.close()),
        this.errorHandler.create({label: 'Create project'}),
      ).toPromise();
    });
    return dialogRef.result;
  }

  /**
   * Open a dialog to edit a project.
   * @param project the project to edit
   */
  openEditDialog(project: ProjectImpl): Promise<ProjectImpl> {
    const dialogRef = this.modalService.open(ProjectEditDialogComponent);
    dialogRef.componentInstance.project = project;
    dialogRef.componentInstance.accept = ((value: ProjectEditDialogValue) => {
      const progressDialogRef = this.createProgressDialog(`Saving changes to '${project.name}'...`);
      return this.projectService.save([project.hashId], value.request, {
        [project.hashId]: project,
      })
        .pipe(
          finalize(() => progressDialogRef.close()),
          this.errorHandler.create({label: 'Edit project'}),
        )
        .toPromise();
    });
    return dialogRef.result;
  }

  /**
   * Open a dialog to modify a project's collaborators.
   * @param project the project to edit
   */
  openCollaboratorsDialog(project: ProjectImpl): Promise<any> {
    const dialogRef = this.modalService.open(ProjectCollaboratorsDialogComponent);
    dialogRef.componentInstance.project = project;
    return dialogRef.result;
  }

  openShareDialog(project: ProjectImpl): Promise<any> {
    const modalRef = this.modalService.open(CopyLinkDialogComponent);
    modalRef.componentInstance.url = `${window.location.origin}/${project.getURL()}`;
    return modalRef.result;
  }

}

export class CreateDialogOptions {
  title?: string;
  request?: Partial<ProjectCreateRequest>;
}
