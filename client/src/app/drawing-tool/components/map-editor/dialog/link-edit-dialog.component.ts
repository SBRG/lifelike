import { Component, Input } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { Hyperlink, Source } from 'app/drawing-tool/services/interfaces';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { potentiallyInternalUrl } from 'app/shared/validators';
import { toValidLink } from 'app/shared/utils/browser';

@Component({
  selector: 'app-link-edit-dialog',
  templateUrl: './link-edit-dialog.component.html',
})
export class LinkEditDialogComponent extends CommonFormDialogComponent<Source | Hyperlink> {

  @Input() title = 'Edit Link';

  private _link: Source | Hyperlink;
  readonly errors = {
    url: 'The provided URL is not valid.',
  };
  readonly domainDefault = 'Link';

  readonly form: FormGroup = new FormGroup({
    domain: new FormControl(''),
    url: new FormControl('', [
      Validators.required,
      potentiallyInternalUrl,
    ]),
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
  }

  get link(): Source | Hyperlink {
    return this._link;
  }

  set link(value: Source | Hyperlink) {
    this._link = value;
    this.form.patchValue(value);
  }

  getValue(): Source {
    this.link.domain = this.form.controls.domain.value || this.domainDefault;
    this.link.url = toValidLink(this.form.controls.url.value);
    return this.link;
  }

}
