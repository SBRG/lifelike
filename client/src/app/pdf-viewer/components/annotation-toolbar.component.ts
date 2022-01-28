import { Component, ElementRef, NgZone, Output, EventEmitter, Input, HostBinding, ViewEncapsulation } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { openModal } from 'app/shared/utils/modals';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { AnnotationEditDialogComponent } from './annotation-edit-dialog.component';
import { Rect } from '../annotation-type';

@Component({
  selector: 'app-annotation-toolbar',
  styleUrls: ['./annotation-toolbar.component.scss'],
  templateUrl: './annotation-toolbar.component.html',
  encapsulation: ViewEncapsulation.None
})
export class AnnotationToolbarComponent {

  constructor(protected readonly elementRef: ElementRef,
              protected readonly modalService: NgbModal,
              protected readonly zone: NgZone,
              protected readonly snackBar: MatSnackBar,
              protected readonly errorHandler: ErrorHandler) {
  }

  @Input() set position(position) {
    this.style = {
      visibility: 'visible',
      top: position.top + 'px',
      left: position.left + 'px'
    };
  }

  @Input() pageRef;

  @HostBinding('class.active') @Input() active: boolean;

  @Input() containerRef;

  @Output() annotationCreated = new EventEmitter();

  @HostBinding('style') style: { [klass: string]: any } | null;

  copySelectionText(event) {
    event.preventDefault();
    navigator.clipboard.writeText(window.getSelection().toString()).then(() => {
      this.snackBar.open('Copied text to clipboard.', null, {
        duration: 2000,
      });
    }, () => {
      this.snackBar.open('Failed to copy text.', null, {
        duration: 2000,
      });
    });
  }

  private detectPageFromRanges(ranges: Range[]): number | undefined {
    for (const range of ranges) {
      const element: Element = ranges[0].commonAncestorContainer.parentElement;
      const pageElement = element.closest('.page');
      if (pageElement) {
        return parseInt(pageElement.getAttribute('data-page-number'), 10);
      }
    }
    return null;
  }

  openAnnotationPanel(event) {
    event.preventDefault();
    const selection = window.getSelection();
    const text = selection.toString().trim();
    const ranges = this.getValidSelectionRanges(selection);
    const currentPage = this.detectPageFromRanges(ranges);

    if (ranges.length && currentPage != null) {
      const dialogRef = openModal(this.modalService, AnnotationEditDialogComponent);
      dialogRef.componentInstance.allText = text;
      dialogRef.componentInstance.keywords = [text];
      dialogRef.componentInstance.coords = this.toPDFRelativeRects(currentPage, ranges.map(range => range.getBoundingClientRect()));
      dialogRef.componentInstance.pageNumber = currentPage;
      dialogRef.result.then(annotation => {
        this.annotationCreated.emit(annotation);
        window.getSelection().empty();
      }, () => {
        // reselect text if canceled
        ranges.forEach(r => window.getSelection().addRange(r));
      });
    } else {
      this.errorHandler.showError(new Error('openAnnotationPanel(): failed to get selection or page on PDF viewer'));
    }
  }

  private toPDFRelativeRects(pageNumber: number, rects: (ClientRect | DOMRect)[]): Rect[] {
    const pdfPageView = this.pageRef[pageNumber];
    const viewport = pdfPageView.viewport;
    const pageRect = pdfPageView.canvas.getClientRects()[0];
    const ret: Rect[] = [];
    for (const r of rects) {
      ret.push(viewport.convertToPdfPoint(r.left - pageRect.left, r.top - pageRect.top)
        .concat(viewport.convertToPdfPoint(r.right - pageRect.left, r.bottom - pageRect.top)));
    }
    return ret;
  }

  isSelectionAnnotatable(): boolean {
    const text = window.getSelection().toString();
    return text.trim() !== '';
  }

  /**
   * Get a list of valid selections within the text.
   *
   * @param selection the selection to parse
   */
  private getValidSelectionRanges(selection: Selection): Range[] {
    const ranges: Range[] = [];
    const container = this.containerRef.nativeElement;
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      if (range.startOffset !== range.endOffset && (container.contains(range.startContainer) || container.contains(range.endContainer))) {
        ranges.push(range);
      }
    }
    return ranges;
  }
}
