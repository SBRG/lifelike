import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, Input, OnInit } from '@angular/core';
import { FormGroup, FormArray } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';

@Component({
  selector: 'app-enrichment-table-order-dialog',
  templateUrl: './enrichment-table-order-dialog.component.html',
  styleUrls: ['./enrichment-table-order-dialog.component.scss'],
})
export class EnrichmentTableOrderDialogComponent extends CommonFormDialogComponent implements OnInit {
  @Input() domains: string[];

  form: FormGroup = new FormGroup({
    domainsList: new FormArray([]),
  });

  constructor(
    modal: NgbActiveModal,
    messageDialog: MessageDialog,
  ) {
    super(modal, messageDialog);
  }

  ngOnInit() {

  }

  getValue() {
    return this.domains;
  }

  drop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.domains, event.previousIndex, event.currentIndex);
  }
}
