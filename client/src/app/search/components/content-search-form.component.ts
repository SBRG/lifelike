import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { FormComponent } from 'app/shared/components/base/form.component';
import { SearchableRequestOptions } from 'app/shared/schemas/common';

import { ContentSearchOptions } from '../content-search';

@Component({
  selector: 'app-content-search-form',
  templateUrl: './content-search-form.component.html',
})
export class ContentSearchFormComponent extends FormComponent<ContentSearchOptions> {
  @Input() queryString: string;
  @Output() queryStringChange = new EventEmitter<string>();
  @Output() formResult = new EventEmitter<SearchableRequestOptions>();

  form = new FormGroup({
    q: new FormControl(''),
  });

  constructor(messageDialog: MessageDialog) {
    super(messageDialog);
  }

  queryChanged() {
    this.queryStringChange.emit(this.queryString);
  }

  submit() {
    this.form.patchValue({q: this.queryString});
    super.submit();
  }
}
