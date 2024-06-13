import { Component, Input } from '@angular/core';

import { NgbActiveModal, NgbModal, NgbNavChangeEvent } from '@ng-bootstrap/ng-bootstrap';

import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { SharedSearchService } from 'app/shared/services/shared-search.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { AnnotationMethods, NLPANNOTATIONMODELS } from 'app/interfaces/annotation';
import { ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { FORMATS_WITH_POSSIBLE_DESCRIPTION } from 'app/shared/constants';
import { extractDescriptionFromSankey } from 'app/shared-sankey/constants';

import { ObjectEditDialogComponent } from './object-edit-dialog.component';
import { ObjectCreateRequest } from '../../schema';

@Component({
  selector: 'app-object-upload-dialog',
  templateUrl: './object-upload-dialog.component.html'
})
export class ObjectUploadDialogComponent extends ObjectEditDialogComponent {

  @Input() request = {};

  readonly annotationMethods: AnnotationMethods[] = ['NLP', 'Rules Based'];
  readonly annotationModels = Object.keys(ENTITY_TYPE_MAP).filter(
    key => NLPANNOTATIONMODELS.has(key)).map(hasKey => hasKey);

  // TODO: We can think about removing this after we add task queue for annotations
  readonly maxFileCount = 5;

  fileList: FileInput[] = [];
  selectedFile: FileInput = null;
  selectedFileIndex;

  invalidInputs = false;

  // TODO: Do we want to trim this extension? Do we want to trim more extensions (.pdf)?
  readonly extensionsToCutRegex = /.map$/;

  constructor(modal: NgbActiveModal,
              messageDialog: MessageDialog,
              protected readonly search: SharedSearchService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly progressDialog: ProgressDialog,
              protected readonly modalService: NgbModal) {
    super(modal, messageDialog, modalService);
  }

  // NOTE: We can add the rest of the request data here, but, to be honest, it is redundant.
  // @ts-ignore
  getValue(): ObjectCreateRequest[] {
    const value = this.form.value;

    if (this.fileList.length) {
      // This saves the info about current file
      this.changeSelectedFile(this.selectedFileIndex);
      const uploadRequests = [];
      for (const file of this.fileList) {
        const formState = file.formState;
        uploadRequests.push({
          ...this.createObjectRequest(formState),
          parentHashId: value.parent ? value.parent.hashId : null,
          contentValue: formState.contentValue,
          ...this.request,
        });
      }
      return uploadRequests;
    }

    return [{
      ...this.createObjectRequest(value),
      ...(value.contentSource === 'contentUrl') && {contentUrl: value.contentUrl},
      ...this.request,
    } as ObjectCreateRequest];
  }

  async fileChanged(event) {
    const uploadLimit = this.maxFileCount - this.fileList.length;
    for (let i = 0; (i < event.target.files.length) && (i <= uploadLimit); i++) {
      const targetFile = event.target.files[i];
      const filename: string = targetFile.name.replace(this.extensionsToCutRegex, '');
      await this.extractDescription(targetFile, filename.split('.').pop()).then(description => {
        const fileEntry: FileInput = {
          formState: {
            contentValue: targetFile,
            filename,
            description,
            public: false,
            organism: null,
            annotationsConfigs: {
              annotationMethods: this.defaultAnnotationMethods,
              excludeReferences: true
            }
          },
          filename,
          hasErrors: false,
          filePossiblyAnnotatable: targetFile.type === 'application/pdf',
        };
        this.fileList.push(fileEntry);
        this.changeSelectedFile(this.fileList.length - 1);
      });
    }
  }



  activeTabChanged(event: NgbNavChangeEvent) {
    if (this.fileList.length ||  this.form.get('contentUrl').value.length) {
      if (!confirm('Are you sure? Your progress will be lost!')) {
        event.preventDefault();
        return;
      }
    }
    this.fileList = [];
    this.selectedFile = null;
    this.selectedFileIndex = -1;
    this.form.get('contentUrl').setValue('');
    this.form.get('contentSource').setValue(event.nextId);
    this.form.get('contentValue').setValue(null);
    this.form.get('filename').setValue('');
    this.filePossiblyAnnotatable = false;
    this.invalidInputs = false;
  }

  urlChanged(event) {
    this.form.get('filename').setValue(this.extractFilename(event.target.value));
    this.filePossiblyAnnotatable = this.form.get('contentUrl').value.length;
  }


  changeSelectedFile(newIndex: number) {
    const fileCount = this.fileList.length;
    if (fileCount === 0) {
      this.selectedFileIndex = -1;
      this.form.get('contentValue').setValue(null);
      this.filePossiblyAnnotatable = false;
      this.form.get('filename').setValue('');
      this.form.get('description').setValue('');
      return;
    }
    if (newIndex >= fileCount ) {
      newIndex = this.fileList.length - 1;
    }
    if (this.selectedFile) {
      // Update file
      this.fileList[this.selectedFileIndex] = {
        filename: this.form.get('filename').value,
        formState: this.form.value,
        hasErrors: !this.form.valid,
        filePossiblyAnnotatable: this.filePossiblyAnnotatable,
      };
    }
    this.selectedFile = this.fileList[newIndex];
    this.selectedFileIndex = newIndex;
    this.form.patchValue(this.selectedFile.formState);
    this.form.markAsDirty();
    this.filePossiblyAnnotatable = this.selectedFile.filePossiblyAnnotatable;
    // Remove the warnings - they will come back if switched again
    this.selectedFile.hasErrors = false;
    this.invalidInputs = this.fileList.some((file) => file.hasErrors);

  }

  private extractFilename(s: string): string {
    s = s.replace(/^.*[/\\]/, '').trim();
    if (s.length) {
      return s.replace(/(?:\.llmap)?\.json$/i, '');
    } else {
      const isMap = s.match(/\.json$/i);
      return 'document' + (isMap ? '' : '.pdf');
    }
  }

  private extractDescription(file: File, format: string): Promise<string> {
     if (FORMATS_WITH_POSSIBLE_DESCRIPTION.includes(format)) {
       return file.text().then(text => {
          if (format === 'graph') {
            return extractDescriptionFromSankey(text);
          }
          return '';
       });
     }
     return Promise.resolve('');
  }

  handleDelete(index: number) {
    this.fileList.splice(index, 1);
    this.selectedFile = null;
    this.changeSelectedFile(this.fileList.length - 1);
  }

}

export interface FileInput {
  filename: string;
  formState: any;
  hasErrors: boolean;
  filePossiblyAnnotatable: boolean;
}
