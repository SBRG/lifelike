import { AfterViewInit, Component, OnChanges, } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { get } from 'lodash-es';

import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { ViewService } from 'app/file-browser/services/view.service';

import { ObjectMenuComponent } from '../object-menu/object-menu.component';
import { CopyLinkDialogComponent } from '../dialog/copy-link-dialog.component';
import { ModuleAwareComponent } from '../../modules';

/**
 * app-object-menu in module context
 */
@Component({
  selector: 'app-module-menu',
  templateUrl: '../object-menu/object-menu.component.html',
})
export class ModuleMenuComponent extends ObjectMenuComponent implements AfterViewInit, OnChanges {
  constructor(readonly router: Router,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly route: ActivatedRoute,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly actions: FilesystemObjectActions,
              protected readonly objectTypeService: ObjectTypeService,
              protected readonly viewService: ViewService) {
    super(router, snackBar, modalService, errorHandler, route, workspaceManager, actions, objectTypeService);
  }

  async openShareDialog(target: FilesystemObject) {
    let url;
    let componentInstance: ModuleAwareComponent;
    const {focusedPane} = this.workspaceManager;
    if (focusedPane) {
      const {activeTab} = focusedPane;
      url = activeTab.url;
      componentInstance = activeTab.getComponent();
    } else {
      // in case of primary outlet
      url = this.router.url;
      // @ts-ignore
      const {contexts} = this.router.rootContexts;
      componentInstance = get(contexts.get('primary'), 'outlet.component');
    }
    const modalRef = this.modalService.open(CopyLinkDialogComponent);
    modalRef.componentInstance.url = 'Generating link...';
    const urlSubscription = this.viewService.getShareableLink(componentInstance, url).subscribe(({href}) => {
      modalRef.componentInstance.url = href;
    });
    // todo: use hidden after update of ng-bootstrap >= 8.0.0
    // https://ng-bootstrap.github.io/#/components/modal/api#NgbModalRef
    modalRef.result.then(
      () => urlSubscription.unsubscribe(),
      () => urlSubscription.unsubscribe()
    );
    return modalRef.result;
  }
}
