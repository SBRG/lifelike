import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { ENTITY_TYPE_MAP, ENTITY_TYPES, DatabaseType } from 'app/shared/annotation-types';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { SEARCH_LINKS } from 'app/shared/links';
import { AnnotationType } from 'app/shared/constants';
import { Hyperlink } from 'app/drawing-tool/services/interfaces';

import { Annotation } from '../annotation-type';

@Component({
  selector: 'app-annotation-panel',
  templateUrl: './annotation-edit-dialog.component.html',
  // needed to make links inside *ngFor to work and be clickable
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AnnotationEditDialogComponent extends CommonFormDialogComponent {
  @Input() pageNumber: number;
  @Input() keywords: string[];
  @Input() coords: number[][];
  @Input() set allText(allText: string) {
    this.form.patchValue({text: allText});
  }
  isTextEnabled = false;
  sourceLinks: Hyperlink[] = [];

  readonly entityTypeChoices = ENTITY_TYPES;
  readonly errors = {
    url: 'The provided URL is not valid.',
  };

  readonly form: FormGroup = new FormGroup({
    text: new FormControl({value: '', disabled: true}, Validators.required),
    entityType: new FormControl('', Validators.required),
    id: new FormControl({value: '', disabled: true}),
    source: new FormControl(DatabaseType.NONE),
    sourceLinks: new FormArray([]),
    includeGlobally: new FormControl(false),
  });
  caseSensitiveTypes = [AnnotationType.Gene, AnnotationType.Protein];

  constructor(modal: NgbActiveModal, messageDialog: MessageDialog) {
    super(modal, messageDialog);
  }

  get databaseTypeChoices(): string[] {
    let choices = null;
    const value = this.form.get('entityType').value;
    const dropdown = this.form.get('source');
    if (value === '') {
      dropdown.disable();
      choices = [DatabaseType.NONE];
    } else {
      dropdown.enable();
      if (ENTITY_TYPE_MAP.hasOwnProperty(value)) {
        if (ENTITY_TYPE_MAP[value].sources.indexOf(DatabaseType.NONE) > -1) {
          dropdown.disable();
          choices = [DatabaseType.NONE];
        } else {
          choices = ENTITY_TYPE_MAP[value].sources;
        }
      }
    }
    this._toggleIdField();
    return choices;
  }

  get getSearchLinks() {
    const formRawValues = this.form.getRawValue();
    const text = formRawValues.text.trim();

    return SEARCH_LINKS.map(link => (
      {domain: `${link.domain.replace('_', ' ')}`, link: this.substituteLink(link.url, text)}));
  }

  disableGlobalOption() {
    // need to reset value here so id input also gets reset
    // since the select will always default to "No Source" on entity type change
    this.form.get('source').patchValue('');
    if (['Mutation', 'Pathway'].includes(this.form.get('entityType').value)) {
      this.form.get('includeGlobally').patchValue(false);
      this.form.get('includeGlobally').disable();
      this.form.get('id').updateValueAndValidity();
    } else {
      this.form.get('includeGlobally').enable();
    }
  }

  private _toggleIdField() {
    const dropdown = this.form.get('source');
    if (dropdown.value !== '') {
      this.form.get('id').enable();
      this.form.get('id').setValidators([Validators.required]);
    } else {
      this.form.get('id').patchValue('');
      this.form.get('id').setValidators(null);
      this.form.get('id').disable();
    }
    this.form.get('id').updateValueAndValidity();
  }

  getValue(): Annotation {
    const links = {};
    // getRawValue will return values of disabled controls too
    const formRawValues = this.form.getRawValue();
    const text = formRawValues.text.trim();
    SEARCH_LINKS.forEach(link => {
      links[link.domain.toLowerCase()] = this.substituteLink(link.url, text);
    });

    return {
      pageNumber: this.pageNumber,
      keywords: this.keywords.map(keyword => keyword.trim()),
      rects: this.coords.map((coord) => {
        return [coord[0], coord[3], coord[2], coord[1]];
      }),
      meta: {
        id: this.form.value.id || '',
        idHyperlinks: this.sourceLinks.length > 0 ? this.sourceLinks.map(
          link => JSON.stringify({label: link.domain, url: link.url})) : [],
        idType: this.form.value.source || '',
        type: this.form.value.entityType,
        links,
        isCustom: true,
        allText: text,
        includeGlobally: formRawValues.includeGlobally,
        isCaseInsensitive: !(this.caseSensitiveTypes.includes(this.form.value.entityType)),
      },
    };
  }

  substituteLink(s: string, query: string) {
    return s.replace(/%s/, encodeURIComponent(query));
  }

  enableTextField() {
    this.isTextEnabled = true;
    this.form.controls.text.enable();
  }
}
