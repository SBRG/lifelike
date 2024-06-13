import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';

import { cloneDeep } from 'lodash-es';
import { from, Observable, of, Subscription, throwError } from 'rxjs';
import { auditTime, catchError, finalize, switchMap } from 'rxjs/operators';

import { MovableNode } from 'app/graph-viewer/renderers/canvas/behaviors/node-move.behavior';
import { InteractiveEdgeCreationBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/interactive-edge-creation.behavior';
import { HandleResizableBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/handle-resizable.behavior';
import { mapBlobToBuffer, mapBufferToJson, readBlobAsBuffer } from 'app/shared/utils/files';
import {
  CompoundAction,
  GraphAction,
  GraphActionReceiver,
} from 'app/graph-viewer/actions/actions';
import { mergeDeep } from 'app/graph-viewer/utils/objects';
import { CanvasGraphView } from 'app/graph-viewer/renderers/canvas/canvas-graph-view';
import { ObjectVersion } from 'app/file-browser/models/object-version';
import { LockError } from 'app/file-browser/services/filesystem.service';
import { ObjectLock } from 'app/file-browser/models/object-lock';
import { MimeTypes } from 'app/shared/constants';
import { DeleteKeyboardShortcutBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/delete-keyboard-shortcut.behavior';
import { PasteKeyboardShortcutBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/paste-keyboard-shortcut.behavior';
import { HistoryKeyboardShortcutsBehavior } from 'app/graph-viewer/renderers/canvas/behaviors/history-keyboard-shortcuts.behavior';
import {ImageUploadBehavior} from 'app/graph-viewer/renderers/canvas/behaviors/image-upload.behavior';
import {DragDropEntityBehavior} from 'app/graph-viewer/renderers/canvas/behaviors/drag-drop-entity.behavior';

import { KnowledgeMap, UniversalGraph } from '../../services/interfaces';
import { MapViewComponent } from '../map-view.component';
import { MapRestoreDialogComponent } from '../map-restore-dialog.component';
import { InfoPanel } from '../../models/info-panel';
import { GRAPH_ENTITY_TOKEN } from '../../providers/graph-entity-data.provider';
import { extractGraphEntityActions } from '../../utils/data';

@Component({
  selector: 'app-drawing-tool',
  templateUrl: './map-editor.component.html',
  styleUrls: [
    '../map.component.scss',
    './map-editor.component.scss',
  ],
})
export class MapEditorComponent extends MapViewComponent<UniversalGraph | undefined> implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('infoPanelSidebar', {static: false}) infoPanelSidebarElementRef: ElementRef;
  @ViewChild('modalContainer', {static: false}) modalContainer: ElementRef;
  autoSaveDelay = 5000;
  autoSaveSubscription: Subscription;

  private readonly lockCheckTimeInterval = 1000 * 30;
  private readonly slowLockCheckTimeInterval = 1000 * 60 * 2;
  private readonly veryInactiveDuration = 1000 * 60 * 30;
  private readonly inactiveDuration = 1000 * 60 * 5;

  private lockIntervalId = null;
  private lockStartIntervalId = null;
  lockAcquired: boolean | undefined = null;
  locks: ObjectLock[] = [];
  private lastLockCheckTime = window.performance.now();
  private lastActivityTime = window.performance.now();
  reloadPopupDismissed = false;
  infoPanel = new InfoPanel();
  activeTab: string;

  dropTargeted = false;

  providerSubscription$ = new Subscription();

  ngOnInit() {
    this.autoSaveSubscription = this.unsavedChanges$.pipe(auditTime(this.autoSaveDelay)).subscribe(changed => {
      if (changed) {
        this.saveBackup();
      }
    });

    this.ngZone.runOutsideAngular(() => {
      this.canvasChild.nativeElement.addEventListener('dragend', e => {
        this.dragEnd(e);
      });

      this.canvasChild.nativeElement.addEventListener('dragleave', e => {
        this.dragLeave(e);
      });

      this.canvasChild.nativeElement.addEventListener('dragover', e => {
        this.dragOver(e);
      });

      this.canvasChild.nativeElement.addEventListener('drop', e => {
        this.drop(e);
      });
    });

    this.startLockInterval();
  }

  ngAfterViewInit() {
    super.ngAfterViewInit();

    Promise.resolve().then(() => {
      this.subscriptions.add(this.graphCanvas.historyChanges$.subscribe(() => {
        this.unsavedChanges$.next(true);
      }));

      this.subscriptions.add(this.graphCanvas.editorPanelFocus$.subscribe(() => {
        this.focusSidebar();
      }));
    });
  }

  ngOnDestroy() {
    super.ngOnDestroy();
    this.providerSubscription$.unsubscribe();
    this.autoSaveSubscription.unsubscribe();

    this.clearLockInterval();
  }

  getExtraSource(): Observable<UniversalGraph | null> {
    return from([this.locator]).pipe(switchMap(
      locator => this.filesystemService.getBackupContent(locator)
        .pipe(
          switchMap(blob => blob
            ? of(blob).pipe(
              mapBlobToBuffer(),
              mapBufferToJson<UniversalGraph>(),
            )
            : of(null)),
          this.errorHandler.create({label: 'Load map backup'}),
        ),
    ));
  }

  handleExtra(backup: UniversalGraph | null) {
    if (backup != null) {
      this.modalService.open(MapRestoreDialogComponent, {
        container: this.modalContainer.nativeElement,
      }).result.then(() => {
        this.graphCanvas.execute(new KnowledgeMapRestore(
          `Restore map to backup`,
          this.graphCanvas,
          backup,
          cloneDeep(this.graphCanvas.getGraph()),
        ));
      }, () => {
        this.filesystemService.deleteBackup(this.locator)
          .subscribe(); // Need to subscribe so it actually runs
      });
    }

    this.acquireLock();
  }

  registerGraphBehaviors() {
    super.registerGraphBehaviors();
    this.graphCanvas.behaviors.add('delete-keyboard-shortcut',
      new DeleteKeyboardShortcutBehavior(this.graphCanvas), -100);
    this.graphCanvas.behaviors.add('paste-keyboard-shortcut',
      new PasteKeyboardShortcutBehavior(this.graphCanvas, this.dataTransferDataService), -100);
    this.graphCanvas.behaviors.add('image-upload',
      new ImageUploadBehavior(this.graphCanvas, this.mapImageProviderService, this.snackBar), -100);
    this.graphCanvas.behaviors.add('history-keyboard-shortcut',
      new HistoryKeyboardShortcutsBehavior(this.graphCanvas, this.snackBar), -100);
    this.graphCanvas.behaviors.add('moving', new MovableNode(this.graphCanvas), -10); // from below
    this.graphCanvas.behaviors.add('resize-handles', new HandleResizableBehavior(this.graphCanvas), 0);
    this.graphCanvas.behaviors.add('edge-creation',
      new InteractiveEdgeCreationBehavior(this.graphCanvas), 1);
    // Disabling this for now, since this is redundant with the canvasChild event listeners setup above. Those callbacks seem to be the
    // preferred ones for drag-and-drop.
    // this.graphCanvas.behaviors.add('drag-drop-entity', new DragDropEntityBehavior(this.graphCanvas), 1);
  }

  save() {
    super.save();
    this.filesystemService.deleteBackup(this.locator)
      .subscribe(); // Need to subscribe so it actually runs
  }

  saveBackup(): Observable<any> {
    if (this.map) {
      const observable = this.filesystemService.putBackup({
        hashId: this.locator,
        contentValue: new Blob([JSON.stringify(this.graphCanvas.getGraph())], {
          type: MimeTypes.Map,
        }),
      });
      observable.subscribe(); // Need to subscribe so it actually runs
      return observable;
    }
  }

  restore(version: ObjectVersion) {
    this.providerSubscription$ = this.objectTypeService.get(version.originalObject).pipe().subscribe(async (typeProvider) => {
      await typeProvider.unzipContent(version.contentValue).pipe().subscribe(unzippedGraph => {
        readBlobAsBuffer(new Blob([unzippedGraph], { type: MimeTypes.Map })).pipe(
          mapBufferToJson<UniversalGraph>(),
          this.errorHandler.create({label: 'Restore map from backup'}),
        ).subscribe(graph => {
          this.graphCanvas.execute(new KnowledgeMapRestore(
            `Restore map to '${version.hashId}'`,
            this.graphCanvas,
            graph,
            cloneDeep(this.graphCanvas.getGraph()),
          ));
        }, e => {
          // Data is corrupt
          // TODO: Prevent the user from editing or something so the user doesnt lose data?
        });
      });
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event) {
    if (this.shouldConfirmUnload()) {
      event.returnValue = 'Leave page? Changes you made may not be saved';
    }
  }

  dragEnd(event: DragEvent) {
    this.ngZone.run(() => {
      this.dropTargeted = false;
    });
  }

  dragLeave(event: DragEvent) {
    this.ngZone.run(() => {
      this.dropTargeted = false;
    });
  }

  dragOver(event: DragEvent) {
    if (this.dataTransferDataService.extract(event.dataTransfer).filter(item => item.token === GRAPH_ENTITY_TOKEN).length) {
      event.dataTransfer.dropEffect = 'link';
      event.preventDefault();
      if (!this.dropTargeted) {
        this.ngZone.run(() => {
          this.dropTargeted = true;
        });
      }
    }
  }

  drop(event: DragEvent) {
    event.preventDefault();

    this.ngZone.run(() => {
      this.dropTargeted = false;
    });

    const hoverPosition = this.graphCanvas.hoverPosition;
    if (hoverPosition != null) {
      const items = this.dataTransferDataService.extract(event.dataTransfer);
      const actions = extractGraphEntityActions(items, hoverPosition);

      if (actions.length) {
        this.graphCanvas.execute(new CompoundAction('Drag to map', actions));
        this.graphCanvas.focus();
      }
    }
  }

  private focusSidebar() {
    // Focus the input on the sidebar
    setTimeout(() => {
      const initialFocusElement = this.infoPanelSidebarElementRef.nativeElement.querySelector('.map-editor-initial-focus');
      if (initialFocusElement) {
        initialFocusElement.focus();
        initialFocusElement.select();
      }
    }, 100);
  }

  get lockCheckingActive(): boolean {
    return this.lockIntervalId != null || this.lockStartIntervalId != null;
  }

  acquireLock() {
    const monotonicNow = window.performance.now();

    if (monotonicNow - this.lastActivityTime > this.veryInactiveDuration) {
      // If the user is inactive for too long, stop hitting our poor server
      this.clearLockInterval();
    } else if (monotonicNow - this.lastActivityTime > this.inactiveDuration) {
      // If the user is inactive for a bit, let's slow down the checking interval
      if (monotonicNow - this.lastLockCheckTime < this.slowLockCheckTimeInterval) {
        return;
      }
    }

    if (this.lockAcquired === false) {
      this.filesystemService.getLocks(this.locator).pipe(
        finalize(() => this.lastLockCheckTime = window.performance.now()),
      ).subscribe(locks => {
        this.ngZone.run(() => {
          this.locks = locks;
        });
      });
    } else {
      this.filesystemService.acquireLock(this.locator).pipe(
        finalize(() => this.lastLockCheckTime = window.performance.now()),
        catchError(error => {
          if (!(error instanceof LockError)) {
            this.errorHandler.showError(error);
          }
          return throwError(error);
        }),
      ).subscribe(locks => {
        this.lockAcquired = true;
        this.ngZone.run(() => {
          this.locks = locks;
        });
      }, (err: LockError) => {
        this.lockAcquired = false;
        this.ngZone.run(() => {
          this.locks = 'locks' in err ? err.locks : [];
        });
      });
    }
  }

  startLockInterval() {
    this.lockAcquired = null;

    // Make the timer start near the crossing of the second hand, to make it look like the
    // lock indication is live, even through we actually check infrequently
    this.lockStartIntervalId = setTimeout(() => {
      this.lockIntervalId = setInterval(this.acquireLock.bind(this), this.lockCheckTimeInterval);
    }, (60 - new Date().getSeconds() + 1));

    this.acquireLock();
  }

  clearLockInterval() {
    if (this.lockStartIntervalId != null) {
      clearInterval(this.lockStartIntervalId);
      this.lockStartIntervalId = null;
    }
    if (this.lockIntervalId != null) {
      clearInterval(this.lockIntervalId);
      this.lockIntervalId = null;
    }
  }

  reload() {
    const doReload = () => {
      this.clearLockInterval();
      this.loadTask.update(this.locator);
      this.startLockInterval();
    };
    if (this.unsavedChanges$.value) {
      if (confirm('You have unsaved changes. Are you sure that you want to reload?')) {
        doReload();
      }
    } else {
      doReload();
    }
  }

  dismissReloadPopup() {
    this.reloadPopupDismissed = true;
  }

  @HostListener('window:mousemove', ['$event'])
  mouseMove(event: MouseEvent) {
    this.lastActivityTime = window.performance.now();
  }

  @HostListener('window:keydown', ['$event'])
  keyDown(event: MouseEvent) {
    this.lastActivityTime = window.performance.now();
  }
}

class KnowledgeMapUpdate implements GraphAction {
  constructor(public description: string,
              public map: KnowledgeMap,
              public updatedData: Partial<KnowledgeMap>,
              public originalData: Partial<KnowledgeMap>) {
  }

  apply(component: GraphActionReceiver) {
    mergeDeep(this.map, this.updatedData);
  }

  rollback(component: GraphActionReceiver) {
    mergeDeep(this.map, this.originalData);
  }
}


class KnowledgeMapRestore implements GraphAction {
  constructor(public description: string,
              public graphCanvas: CanvasGraphView,
              public updatedData: UniversalGraph,
              public originalData: UniversalGraph) {
  }

  apply(component: GraphActionReceiver) {
    this.graphCanvas.setGraph(cloneDeep(this.updatedData));
    this.graphCanvas.zoomToFit(0);
  }

  rollback(component: GraphActionReceiver) {
    this.graphCanvas.setGraph(cloneDeep(this.originalData));
    this.graphCanvas.zoomToFit(0);
  }
}
