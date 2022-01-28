import { Component, HostListener, Input } from '@angular/core';
import { NG_VALUE_ACCESSOR } from '@angular/forms';

import { cloneDeep } from 'lodash-es';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { AbstractControlValueAccessor } from 'app/shared/utils/forms/abstract-control-value-accessor';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';
import {
  LABEL_TOKEN,
  URI_TOKEN,
  URIData,
} from 'app/shared/providers/data-transfer-data/generic-data.provider';
import { openPotentialInternalLink, toValidLink } from 'app/shared/utils/browser';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { MessageDialog } from 'app/shared/services/message-dialog.service';
import { MessageType } from 'app/interfaces/message-dialog.interface';

import { Hyperlink, Source } from '../services/interfaces';
import { LinkEditDialogComponent } from './map-editor/dialog/link-edit-dialog.component';

@Component({
  selector: 'app-links-panel',
  templateUrl: './links-panel.component.html',
  styleUrls: [
    './links-panel.component.scss',
  ],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: LinksPanelComponent,
    multi: true,
  }],
})
export class LinksPanelComponent extends AbstractControlValueAccessor<(Source | Hyperlink)[]> {

  @Input() title = 'Links';
  @Input() singularTitle = 'Link';
  @Input() showHeader = true;
  @Input() editable = true;
  @Input() fontAwesomeIcon = 'fa fa-link';
  @Input() draggable = true;
  @Input() limit = null;

  dropTargeted = false;
  activeLinkIndex = -1;

  constructor(protected readonly dataTransferData: DataTransferDataService,
              protected readonly modalService: NgbModal,
              protected readonly workspaceManager: WorkspaceManager,
              protected readonly messageDialog: MessageDialog) {
    super();
  }

  getDefaultValue(): (Source | Hyperlink)[] {
    return [];
  }

  @HostListener('dragover', ['$event'])
  dragOver(event: DragEvent) {
    if (this.editable) {
      this.dropTargeted = true;
      event.dataTransfer.dropEffect = 'copy';
      event.preventDefault();
      event.stopPropagation();
    }
  }

  @HostListener('dragend', ['$event'])
  dragEnd(event: DragEvent) {
    this.dropTargeted = false;
  }

  @HostListener('dragleave', ['$event'])
  dragLeave(event: DragEvent) {
    this.dropTargeted = false;
  }

  @HostListener('drop', ['$event'])
  drop(event: DragEvent) {
    if (this.editable) {
      event.preventDefault();
      event.stopPropagation();
      this.dropTargeted = false;

      const items = this.dataTransferData.extract(event.dataTransfer);
      let text: string | undefined = null;
      const uriData: URIData[] = [];

      for (const item of items) {
        if (item.token === URI_TOKEN) {
          uriData.push(...(item.data as URIData[]));
        } else if (item.token === LABEL_TOKEN) {
          text = item.data as string;
        }
      }

      if (uriData.length) {
        this.openCreateDialog({
          url: uriData[0].uri,
          domain: text.trim(),
        }).then(result => {
        }, () => {
        });
      } else {
        this.openCreateDialog({
          url: '',
          domain: text.trim(),
        }).then(result => {
        }, () => {
        });
      }
    }
  }

  openCreateDialog(link: Source | Hyperlink = {
    domain: '',
    url: '',
  }): Promise<Source> {
    const dialogRef = this.modalService.open(LinkEditDialogComponent);
    dialogRef.componentInstance.title = `New ${this.singularTitle}`;
    dialogRef.componentInstance.link = link;
    dialogRef.componentInstance.accept = ((value: (Source | Hyperlink)) => {
      this.value = [
        ...(this.value || []),
        value,
      ];
      this.activeLinkIndex = -1;
      this.valueChange();
      return Promise.resolve(link);
    });
    return dialogRef.result;
  }

  openEditDialog(link: (Source | Hyperlink)): Promise<Source> {
    const dialogRef = this.modalService.open(LinkEditDialogComponent);
    dialogRef.componentInstance.title = `Edit ${this.singularTitle}`;
    dialogRef.componentInstance.link = cloneDeep(link);
    dialogRef.componentInstance.accept = ((value: (Source | Hyperlink)) => {
      for (const key of Object.keys(link)) {
        link[key] = value[key];
      }
      this.valueChange();
      return Promise.resolve(link);
    });
    return dialogRef.result;
  }

  delete(index: number) {
    this.value.splice(index, 1);
    this.activeLinkIndex = -1;
    this.valueChange();
  }

  getText(domain: string) {
    if (domain === '') {
      return 'Link';
    } else if (domain === 'Upload URL') {
      return 'External URL';
    } else {
      return domain;
    }
  }

  getUrlText(url: string) {
    if (url.startsWith('/')) {
      return window.location.hostname;
    } else {
      try {
        const urlObject = new URL(toValidLink(url));
        return urlObject.hostname.replace(/^www./, '') || url;
      } catch {
        return url;
      }
    }
  }

  toValidUrl(url: string) {
    try {
      return toValidLink(url);
    } catch (e) {
      return '#';
    }
  }

  linkClick(event: Event, link: (Source | Hyperlink)) {
    try {
      openPotentialInternalLink(this.workspaceManager, link.url);
    } catch (e) {
      this.messageDialog.display({
        title: 'Invalid Link',
        message: 'The URL for this link is not valid.',
        type: MessageType.Error,
      });
    }
    event.preventDefault();
    event.stopPropagation();
  }

  linkFocus(event: FocusEvent, link: Source | Hyperlink, index: number) {
    this.activeLinkIndex = index;
  }
}
