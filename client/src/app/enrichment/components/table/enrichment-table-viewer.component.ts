import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { escapeRegExp, isNil } from 'lodash-es';
import { BehaviorSubject, combineLatest, Observable, Subject, Subscription } from 'rxjs';
import { finalize, map, mergeMap, shareReplay, take, tap } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';
import { ObjectVersion } from 'app/file-browser/models/object-version';
import { ObjectUpdateRequest } from 'app/file-browser/schema';
import { ModuleProperties } from 'app/shared/modules';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { NodeTextRange } from 'app/shared/utils/dom';
import { AsyncElementFind } from 'app/shared/utils/find/async-element-find';
import { Progress } from 'app/interfaces/common-dialog.interface';

import { EnrichmentDocument } from '../../models/enrichment-document';
import { EnrichmentTable } from '../../models/enrichment-table';
import { EnrichmentTableService } from '../../services/enrichment-table.service';
import { EnrichmentTableOrderDialogComponent } from './dialog/enrichment-table-order-dialog.component';
import { EnrichmentTableEditDialogComponent, EnrichmentTableEditDialogValue, } from './dialog/enrichment-table-edit-dialog.component';
import { EnrichmentService } from '../../services/enrichment.service';

// TODO: Is there an existing interface we could use here?
interface AnnotationData {
  id: string;
  text: string;
  color: string;
}

@Component({
  selector: 'app-enrichment-table-viewer',
  templateUrl: './enrichment-table-viewer.component.html',
  styleUrls: ['./enrichment-table-viewer.component.scss'],
  providers: [EnrichmentService]
})
export class EnrichmentTableViewerComponent implements OnInit, OnDestroy, AfterViewInit {

  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();
  @ViewChild('tableScroll', {static: false}) tableScrollRef: ElementRef;
  @ViewChildren('findTarget') findTarget: QueryList<ElementRef>;

  annotation: AnnotationData;

  fileId: string;
  object$: Observable<FilesystemObject> = new Subject();
  document$: Observable<EnrichmentDocument> = new Subject();
  table$: Observable<EnrichmentTable> = new Subject();
  scrollTopAmount: number;
  findController: AsyncElementFind;
  findTargetChangesSub: Subscription;
  private tickAnimationFrameId: number;

  /**
   * Keeps tracks of changes so they aren't saved to the server until you hit 'Save'. However,
   * due to the addition of annotations to enrichment tables, this feature has been broken.
   */
  queuedChanges$ = new BehaviorSubject<ObjectUpdateRequest | undefined>(null);

  constructor(protected readonly route: ActivatedRoute,
              protected readonly worksheetViewerService: EnrichmentTableService,
              protected readonly snackBar: MatSnackBar,
              protected readonly modalService: NgbModal,
              protected readonly errorHandler: ErrorHandler,
              protected readonly enrichmentService: EnrichmentService,
              protected readonly progressDialog: ProgressDialog,
              protected readonly changeDetectorRef: ChangeDetectorRef,
              protected readonly elementRef: ElementRef,
              protected readonly filesystemObjectActions: FilesystemObjectActions) {
    this.fileId = this.route.snapshot.params.file_id || '';
    this.annotation = this.parseAnnotationFromUrl(this.route.snapshot.fragment);

    // If the url fragment contains entity id info, assume we're looking for a specific annotation. Otherwise just search text.
    this.findController = new AsyncElementFind(
      null, // We'll update this later, once the table is rendered
      this.annotation.id.length ? this.generateAnnotationFindQueue : this.generateTextFindQueue
    );
    this.findController.query = this.annotation.id.length ? this.annotation.id : this.annotation.text;
  }

  ngOnInit() {
    this.load();
  }

  scrollTop() {
    this.scrollTopAmount = 0;
  }

  onTableScroll(e) {
    this.scrollTopAmount = e.target.scrollTop;
  }

  load() {
    this.object$ = this.enrichmentService.get(this.fileId).pipe(
      tap(() => {
        this.emitModuleProperties();
      }),
      shareReplay(),
    );
    this.document$ = this.enrichmentService.getContent(this.fileId).pipe(
      mergeMap((blob: Blob) => new EnrichmentDocument(this.worksheetViewerService).loadResult(blob, this.fileId)),
      shareReplay(),
    );
    this.table$ = this.document$.pipe(
      mergeMap(document => {
        return new EnrichmentTable().load(document);
      }),
      this.errorHandler.create({label: 'Load enrichment table'}),
      shareReplay(),
    );
    this.tickAnimationFrameId = requestAnimationFrame(this.tick.bind(this));
  }

  ngAfterViewInit() {
    this.findTargetChangesSub = this.findTarget.changes.subscribe({
      next: () => {
        // If the enrichment table is rendered, and we haven't already set the findController target, set it
        if (this.findTarget.first && this.findController.target === null) {
          this.findController.target = this.findTarget.first.nativeElement.getElementsByTagName('tbody')[0];
          // This may seem like an anti-pattern -- and it probably is -- but there is seemingingly no other way around Angular's
          // `ExpressionChangedAfterItHasBeenCheckedError` here. Even Angular seems to think so, as they use this exact pattern in their
          // own example: https://angular.io/api/core/ViewChildren#another-example
          setTimeout(() => {
            // TODO: Need to have a brief background color animation when the table is loaded and the first match is rendered. (?)
            // Actually not sure if this the desired behavior.
            this.findController.start();
          }, 0);
        // Only reset the findController target when the table is reset
        } else if (isNil(this.findTarget.first)) {
          this.findController.target = null;
          setTimeout(() => {
            this.findController.stop();
          }, 0);
        }
      }
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.tickAnimationFrameId);
    if (!isNil(this.findTargetChangesSub)) {
      this.findTargetChangesSub.unsubscribe();
    }
    // Give the findController a chance to teardown any listeners/callbacks/subscriptions etc.
    this.findController.stop();
  }

  parseAnnotationFromUrl(fragment: string): AnnotationData {
    const params = new URLSearchParams(fragment);
    return {
      id: params.get('id') || '',
      text: params.get('text') || '',
      color: params.get('color') || ''
    };
  }

  tick() {
    this.findController.tick();
    this.tickAnimationFrameId = requestAnimationFrame(this.tick.bind(this));
  }

  restore(version: ObjectVersion) {
    this.document$ = new EnrichmentDocument(this.worksheetViewerService).loadResult(version.contentValue, this.fileId).pipe(
      tap(() => this.queuedChanges$.next(this.queuedChanges$.value || {})),
      shareReplay(),
    );
    this.table$ = this.document$.pipe(
      mergeMap(document => {
        return new EnrichmentTable().load(document);
      }),
      this.errorHandler.create({label: 'Restore enrichment table'}),
      shareReplay(),
    );
  }

  refreshData() {
    this.table$ = combineLatest(
      this.document$,
      this.table$,
    ).pipe(
      take(1),
      mergeMap(([document, table]) => document.refreshData().pipe(
        mergeMap(() => new EnrichmentTable().load(document)),
        tap(newTable => {
          this.snackBar.open(
            `Data refreshed.`,
            'Close',
            {duration: 5000},
          );
        }),
      )),
      shareReplay(),
      this.errorHandler.create({label: 'Load enrichment table'}),
    );
  }

  save() {
    const progressDialogRef = this.progressDialog.display({
      title: 'Working...',
      progressObservables: [new BehaviorSubject<Progress>(new Progress({
        status: 'Saving enrichment table...',
      }))],
    });
    const observable = combineLatest(
      this.object$,
      this.document$.pipe(
        // need to use updateParameters instead of save
        // because save only update the import genes list
        // not the matched results
        // so a new version of the file will not get created
        // the newly added gene matched
        mergeMap(document => document.updateParameters()),
      ),
    ).pipe(
      take(1),
      mergeMap(([object, blob]) =>
        this.enrichmentService.save([object.hashId], {
          contentValue: blob,
          ...this.queuedChanges$.value,
        })),
      map(() => {
        this.refreshData();
      }),
      tap(() => this.queuedChanges$.next(null)),
      this.errorHandler.create({label: 'Save enrichment table'}),
      shareReplay(),
      finalize(() => progressDialogRef.close()),
    );

    observable.subscribe(() => {
      this.snackBar.open(
        `Enrichment table saved.`,
        'Close',
        {duration: 5000},
      );
    });

    return observable;
  }

  openNewWindow(enrichmentTable: FilesystemObject) {
    return this.filesystemObjectActions.openNewWindow(enrichmentTable);
  }

  /**
   * Opens EnrichmentTableOrderDialog that gives new column order.
   */
  openOrderDialog() {
    this.document$.pipe(
      take(1),
    ).subscribe(document => {
      const dialogRef = this.modalService.open(EnrichmentTableOrderDialogComponent);
      dialogRef.componentInstance.domains = [...document.domains];
      return dialogRef.result.then((result) => {
        if (document.domains !== result) {
          document.domains = result;
          this.queuedChanges$.next(this.queuedChanges$.value || {});
          this.table$ = new EnrichmentTable().load(document).pipe(
            this.errorHandler.create({label: 'Re-order enrichment table'}),
            shareReplay(),
          );
        }
      }, () => {
      });
    });
  }

  /**
   * Edit enrichment params (essentially the file content) and updates table.
   */
  openEnrichmentTableEditDialog(object: FilesystemObject, document: EnrichmentDocument): Promise<any> {
    const dialogRef = this.modalService.open(EnrichmentTableEditDialogComponent);
    dialogRef.componentInstance.promptObject = false;
    dialogRef.componentInstance.object = object;
    dialogRef.componentInstance.document = document;
    dialogRef.componentInstance.fileId = this.fileId;
    return dialogRef.result.then((result: EnrichmentTableEditDialogValue) => {
      this.queuedChanges$.next({
        ...(this.queuedChanges$.value || {}),
      });
      this.save();
    }, () => {
    });
  }

  emitModuleProperties() {
    this.object$.pipe(
      take(1),
    ).subscribe(object => {
      this.modulePropertiesChange.emit({
        title: object ? object.filename : 'Enrichment Table',
        fontAwesomeIcon: 'table',
      });
    });
  }

  dragStarted(event: DragEvent, object: FilesystemObject) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    object.addDataTransferData(dataTransfer);
  }

  objectUpdate() {
    this.emitModuleProperties();
    this.load();
  }

  switchToTextFind() {
    this.annotation = {id: '', text: '', color: ''};
    this.findController.stop();
    this.findController = new AsyncElementFind(
      this.findController.target,
      this.generateTextFindQueue
    );
  }

  switchToAnnotationFind(id: string, text: string, color: string) {
    this.annotation = {id, text, color};
    this.findController.stop();
    this.findController = new AsyncElementFind(
      this.findController.target,
      this.generateAnnotationFindQueue
    );
  }

  startAnnotationFind(annotationId: string, annotationText: string, annotationColor: string) {
    this.switchToAnnotationFind(annotationId, annotationText, annotationColor);
    this.findController.query = annotationId;
    this.findController.start();
  }

  startTextFind(text: string) {
    this.switchToTextFind();
    this.findController.query = text;
    this.findController.start();
  }

  private* generateAnnotationFindQueue(root: Node, query: string) {
    const annotations = Array.from((root as Element).querySelectorAll('[data-annotation-meta]')) as HTMLElement[];
    for (const annoEl of annotations) {
      const data = JSON.parse(annoEl.getAttribute('data-annotation-meta'));

      if (data.id === query) {
        yield {
          // The elements with `data-annotation-meta` should have exactly one child: the TextNode representing the annotated text
          startNode: annoEl.firstChild,
          endNode: annoEl.firstChild,
          start: 0,
          end: annoEl.textContent.length, // IMPORTANT: `end` is EXCLUSIVE!
        };
      }
    }
  }

  private* generateTextFindQueue(root: Node, query: string): IterableIterator<NodeTextRange | undefined> {
    const queue: Node[] = [
      root,
    ];

    while (queue.length !== 0) {
      const node = queue.shift();
      if (node === undefined) {
        break;
      }

      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          const el = node as HTMLElement;
          const style = window.getComputedStyle(el);
          // Should be true when we find the top-level container for the table cell
          if (style.display === 'block') {
            const regex = new RegExp(escapeRegExp(query), 'ig');
            let match = regex.exec(node.textContent);

            // If there's no match in the root, then there's no reason to continue
            if (match === null) {
              break;
            }

            // Since there was a match, get all the descendant text nodes
            const treeWalker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const textNodes: Node[] = [];
            let currentNode = treeWalker.nextNode(); // Using `nextNode` here skips the root node, which is intended
            while (currentNode) {
              textNodes.push(currentNode);
              currentNode = treeWalker.nextNode();
            }

            // Create a map of the root text content indices to the descendant text node corresponding to that index
            let index = 0;
            const textNodeMap = new Map<number, [Node, number]>();
            for (const textNode of textNodes) {
              for (let i = 0; i < textNode.textContent.length; i++) {
                textNodeMap.set(index++, [textNode, i]);
              }
            }

            while (match !== null) {
              // Need to catch the case where regex.lastIndex returns a value greater than the last index of the text
              const lastIndexIsEOS = regex.lastIndex === node.textContent.length;
              const endOfMatch = lastIndexIsEOS ? regex.lastIndex - 1 : regex.lastIndex;

              yield {
                startNode: textNodeMap.get(match.index)[0],
                endNode: textNodeMap.get(endOfMatch)[0],
                start: textNodeMap.get(match.index)[1],
                end: textNodeMap.get(endOfMatch)[1] + (lastIndexIsEOS ? 1 : 0), // IMPORTANT: `end` is EXCLUSIVE!
              };
              match = regex.exec(node.textContent);
            }
            break;
          }
          queue.push(...Array.from(node.childNodes));
          break;
      }
    }
  }
}
