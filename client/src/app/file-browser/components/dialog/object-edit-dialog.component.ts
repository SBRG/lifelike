import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';

import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { CommonFormDialogComponent } from 'app/shared/components/dialog/common-form-dialog.component';
import { OrganismAutocomplete } from 'app/interfaces';
import { AnnotationMethods, NLPANNOTATIONMODELS } from 'app/interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { filenameValidator } from 'app/shared/validators';
import { MAX_DESCRIPTION_LENGTH } from 'app/shared/constants';

import { FilesystemObject } from '../../models/filesystem-object';
import { AnnotationConfigurations, ObjectCreateRequest } from '../../schema';
import { ObjectSelectionDialogComponent } from './object-selection-dialog.component';

@Component({
  selector: 'app-object-edit-dialog',
  templateUrl: './object-edit-dialog.component.html',
})
export class ObjectEditDialogComponent extends CommonFormDialogComponent<ObjectEditDialogValue> {
  @ViewChild('fileInput', {static: false})
  protected readonly fileInputElement: ElementRef;

  @Input() title = 'Edit Item';
  @Input() parentLabel = 'Location';
  @Input() promptUpload = false;
  @Input() forceAnnotationOptions = false;
  @Input() promptParent = false;

  readonly annotationMethods: AnnotationMethods[] = ['NLP', 'Rules Based'];
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP).filter(
    key => NLPANNOTATIONMODELS.has(key)).map(hasKey => hasKey);

  private _object: FilesystemObject;
  protected filePossiblyAnnotatable = false;

  readonly defaultAnnotationMethods = this.annotationModels.reduce(
            (obj, key) => ({
              ...obj, [key]: new FormGroup(
                {
                  nlp: new FormControl(false),
                  rulesBased: new FormControl(true),
                }),
            }), {});

  readonly form: FormGroup = new FormGroup({
    contentSource: new FormControl('contentValue'),
    contentValue: new FormControl(null),
    contentUrl: new FormControl(''),
    parent: new FormControl(null),
    filename: new FormControl('', [Validators.required, filenameValidator]),
    description: new FormControl('', [Validators.maxLength(MAX_DESCRIPTION_LENGTH)]),
    public: new FormControl(false),
    annotationConfigs: new FormGroup(
      {
        excludeReferences: new FormControl(true),
        annotationMethods: new FormGroup(this.defaultAnnotationMethods),
      }, [Validators.required]),
    organism: new FormControl(null),
    mimeType: new FormControl(null),
  }, (group: FormGroup): ValidationErrors | null => {
    if (this.promptUpload) {
      const contentValueControl = group.get('contentValue');
      const contentUrlControl = group.get('contentUrl');

      if (group.get('contentSource').value === 'contentValue') {
        contentUrlControl.setErrors(null);
        if (!contentValueControl.value) {
          contentValueControl.setErrors({
            required: {},
          });
        }
      } else if (group.get('contentSource').value === 'contentUrl') {
        contentValueControl.setErrors(null);
        if (!contentUrlControl.value) {
          contentUrlControl.setErrors({
            required: {},
          });
        }
      }
    }

    if (this.promptParent) {
      const control = group.get('parent');
      if (!control.value) {
        control.setErrors({
          required: {},
        });
      }
    }

    return null;
  });

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog);
  }

  get object() {
    return this._object;
  }

  @Input()
  set object(value: FilesystemObject) {
    this._object = value;
    this.form.patchValue({
      parent: value.parent,
      filename: value.filename || '',
      description: value.description || '',
      public: value.public || false,
      mimeType: value.mimeType,
      organism: value.fallbackOrganism,
    });

    if (!value.parent) {
      this.promptParent = true;
    }

    const annotationConfigs = value.annotationConfigs;
    if (annotationConfigs != null) {
      let ctrl = (
        (this.form.get('annotationConfigs') as FormGroup).get('annotationMethods') as FormControl);
      if (annotationConfigs.annotationMethods != null) {
        for (const [modelName, config] of Object.entries(annotationConfigs.annotationMethods)) {
          if (ctrl.get(modelName)) {
            ctrl.get(modelName).patchValue(config);
          }
        }
      }

      if (annotationConfigs.excludeReferences != null) {
        ctrl = (
          (this.form.get('annotationConfigs') as FormGroup).get('excludeReferences') as FormControl);
        ctrl.patchValue(annotationConfigs.excludeReferences);
      }
    }
  }

  get possiblyAnnotatable(): boolean {
    return this.object.isAnnotatable || this.filePossiblyAnnotatable || this.forceAnnotationOptions;
  }

  applyValue(value: ObjectEditDialogValue) {
    Object.assign(this.object, value.objectChanges);
  }

  getValue(): ObjectEditDialogValue {
    const value = this.form.value;

    const objectChanges: Partial<FilesystemObject> = {
      parent: value.parent,
      filename: value.filename,
      description: value.description,
      public: value.public,
      mimeType: value.mimeType,
      fallbackOrganism: value.organism,
      annotationConfigs: value.annotationConfigs,
    };

    const request: ObjectCreateRequest = this.createObjectRequest(value);

    return {
      object: this.object,
      objectChanges,
      request,
      annotationConfigs: value.annotationConfigs,
      organism: value.organism
    };
  }

  createObjectRequest(value): ObjectCreateRequest {
    return {
      filename: value.filename,
      parentHashId: value.parent ? value.parent.hashId : null,
      description: value.description,
      public: value.public,
      mimeType: value.mimeType,
      fallbackOrganism: value.organism,
      annotationConfigs: value.annotationConfigs
    };
  }

  organismChanged(organism: OrganismAutocomplete | null) {
    this.form.get('organism').setValue(organism ? organism : null);
  }

  onAnnotationMethodPick(method: string, checked: boolean) {
    const field = this.form.get('annotationMethod');
    field.markAsTouched();
    if (checked) {
      field.setValue(method);
    } else {
      field.setValue(null);
    }
  }

  showFileDialog() {
    this.fileInputElement.nativeElement.click();
  }

  showParentDialog() {
    const dialogRef = this.modalService.open(ObjectSelectionDialogComponent);
    dialogRef.componentInstance.title = 'Select Location';
    dialogRef.componentInstance.emptyDirectoryMessage = 'There are no sub-folders in this folder.';
    dialogRef.componentInstance.objectFilter = (o: FilesystemObject) => o.isDirectory;
    return dialogRef.result.then((destinations: FilesystemObject[]) => {
      this.form.patchValue({
        parent: destinations[0],
      });
    }, () => {
    });
  }
}

export interface ObjectEditDialogValue {
  object: FilesystemObject;
  objectChanges: Partial<FilesystemObject>;
  request: ObjectCreateRequest;
  annotationConfigs: AnnotationConfigurations;
  organism: OrganismAutocomplete;
}
