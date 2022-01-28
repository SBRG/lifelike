import { Component, Input } from '@angular/core';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-rejected-options-dialog',
  templateUrl: './rejected-options-dialog.component.html',
  styleUrls: ['./rejected-options-dialog.component.scss']
})
export class RejectedOptionsDialogComponent {
  @Input() rejectedFolders: string[] = [];

  constructor(
    private readonly modal: NgbActiveModal,
  ) { }

  dismiss() {
    this.modal.dismiss();
  }

  close() {
    this.modal.close();
  }

}
