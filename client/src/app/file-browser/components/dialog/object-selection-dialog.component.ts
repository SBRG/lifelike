import { Component, Input, OnDestroy } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageArguments, MessageDialog } from 'app/shared/services/message-dialog.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';
import { CommonDialogComponent } from 'app/shared/components/dialog/common-dialog.component';

import { FilesystemObject, ProjectImpl } from '../../models/filesystem-object';
import { ObjectSelectService } from '../../services/object-select.service';

@Component({
  selector: 'app-object-selection-dialog',
  templateUrl: './object-selection-dialog.component.html',
  providers: [ObjectSelectService],
})
export class ObjectSelectionDialogComponent
  extends CommonDialogComponent<readonly FilesystemObject[]>
  implements OnDestroy {
  @Input() title = 'Select File';
  @Input() emptyDirectoryMessage = 'There are no items in this folder.';

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              readonly objectSelect: ObjectSelectService) {
    super(modal, messageDialog);
  }

  ngOnDestroy(): void {
  }

  @Input()
  set hashId(hashId: string) {
    this.objectSelect.load(hashId);
  }

  @Input()
  set objectFilter(filter: (item: FilesystemObject) => boolean) {
    this.objectSelect.objectFilter = filter;
  }

  @Input()
  set multipleSelection(multipleSelection: boolean) {
    this.objectSelect.multipleSelection = multipleSelection;
  }

  openProject(project: ProjectImpl) {
    this.hashId = project.root.hashId;
  }

  getValue(): readonly FilesystemObject[] {
    if (this.objectSelect.object.children.selection.length) {
      return this.objectSelect.object.children.selection;
    } else {
      return [this.objectSelect.object];
    }
  }

  submit(): void {
    if (this.objectSelect.object != null) {
      super.submit();
    } else {
      this.messageDialog.display({
        title: 'No Selection',
        message: 'You need to select a project first.',
        type: MessageType.Error,
      } as MessageArguments);
    }
  }

}
