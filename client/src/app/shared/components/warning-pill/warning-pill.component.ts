import { Component } from '@angular/core';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { WarningControllerService } from 'app/shared/services/warning-controller.service';

@Component({
  selector: 'app-warning-pill',
  templateUrl: './warning-pill.component.html'
})
export class WarningPillComponent {
  constructor(
    readonly modalService: NgbModal,
    readonly warningController: WarningControllerService
  ) {
  }

  get warnings() {
    return this.warningController.warnings;
  }

  open(content) {
    const modalRef = this.modalService.open(content, {
      ariaLabelledBy: 'modal-basic-title', windowClass: 'adaptive-modal', size: 'xl'
    });
    modalRef.result
      .then(_ => _, _ => _);
    return modalRef;
  }
}
