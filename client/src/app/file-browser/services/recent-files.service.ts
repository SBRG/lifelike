import { Injectable, Injector, OnDestroy } from '@angular/core';

import { zip, Observable, BehaviorSubject, of, ReplaySubject } from 'rxjs';
import { catchError, distinctUntilChanged, tap } from 'rxjs/operators';
import { isEqual, remove } from 'lodash-es';

import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from './filesystem.service';
import { FilesystemObjectData } from '../schema';

export class RecentFileHashesService implements OnDestroy {
  static readonly RECENT_KEY = 'lifelike_workspace_recentList';
  private readonly storage = localStorage;
  private _hashes: BehaviorSubject<string[]>;
  hashes: Observable<string[]>;

  get currentHashes() {
    // create copy cause rxjs is having problem with mutation
    return [...this._hashes.value];
  }

  constructor(
    protected readonly errorHandler: ErrorHandler
  ) {
    const hashes = this.fetchHashes();
    this._hashes = (new BehaviorSubject<string[]>(hashes));
    this.hashes = this._hashes.pipe(
      // update only upon change
      distinctUntilChanged(isEqual)
    );
    this.hashes.subscribe(
      () => this.saveHashes()
    );
    this.startWatchingStorage();
  }

  private startWatchingStorage(): void {
    window.addEventListener('storage', this.storageEventListener.bind(this));
  }

  private stopWatchingStorage(): void {
    window.removeEventListener('storage', this.storageEventListener.bind(this));
  }

  private storageEventListener(event: StorageEvent) {
    if (
      event.storageArea === this.storage &&
      event.key === RecentFileHashesService.RECENT_KEY
    ) {
      this.setHashes(this.fetchHashes());
    }
  }

  deleteFromHashes(hashId: string, setHashes = true) {
    const hashes = this.currentHashes;
    remove(hashes, h => h === hashId);
    this.setHashes(hashes);
  }

  setHashes(hashes) {
    this._hashes.next(hashes.slice(0, 20));
  }

  addToHashes(hashId: string) {
    const hashes = this.currentHashes;
    remove(hashes, h => h === hashId);
    hashes.unshift(hashId);
    this.setHashes(hashes);
  }

  fetchHashes(): string[] {
    try {
      const strValue = this.storage.getItem(RecentFileHashesService.RECENT_KEY);
      if (strValue) {
        const value = JSON.parse(strValue);
        if (Array.isArray(value)) {
          return value.filter(v => typeof v === 'string' || v instanceof String);
        } else {
          this.errorHandler.logError(new Error(`Recent files list has been corrupted - refreshing`));
        }
      }
    } catch (e) {
      this.errorHandler.logError(e);
    }
    return [];
  }

  saveHashes(): void {
    try {
      const fileHashes = this.currentHashes;
      const strValue = JSON.stringify(fileHashes);
      // don't set if same - do not refresh values in other windows
      if (strValue !== this.storage.getItem(RecentFileHashesService.RECENT_KEY)) {
        this.storage.setItem(RecentFileHashesService.RECENT_KEY, strValue);
      }
    } catch (e) {
      this.errorHandler.logError(e);
      this.clearHashes();
    }
  }

  clearHashes() {
    this._hashes.next([]);
  }

  ngOnDestroy() {
    this.stopWatchingStorage();
    this.saveHashes();
  }
}


@Injectable({providedIn: 'root'})
export class RecentFilesService extends RecentFileHashesService {
  list: ReplaySubject<FilesystemObject[]>;
  loadTask;
  fileObjects = new Map();

  constructor(
    protected readonly injector: Injector,
    readonly errorHandler: ErrorHandler
  ) {
    super(errorHandler);
    this.loadTask = new BackgroundTask<string[], FilesystemObject[]>((fileHashes: string[]) => {
      const filesystemService = this.injector.get<FilesystemService>(FilesystemService);
      return zip(
        ...fileHashes.map(fileHash =>
          filesystemService.get(fileHash, false).pipe(
            catchError(() => {
              // if file does not exist, delete from list
              this.deleteFromHashes(fileHash);
              return of(undefined);
            }),
            tap(fileObj => {
              const {hashId} = fileObj;
              this.fileObjects.set(hashId, fileObj);
            })
          )
        )
      );
    });
    this.list = new ReplaySubject(1);
    this.hashes.subscribe(hashes => {
      const newHashes = hashes.filter(hash => !this.fileObjects.has(hash));
      if (newHashes.length) {
        this.loadTask.update(newHashes);
      } else {
        this.updateList(hashes);
      }
    });
    this.loadTask.results$.subscribe(() => this.updateList());
  }

  updateList(hashes?) {
    hashes = hashes || this.currentHashes;
    this.list.next(this.mapHashes(hashes));
  }

  updateFileObjects(obj) {
    Object.entries(obj).forEach(([hashId, fileObj]) => {
      this.fileObjects.set(hashId, fileObj);
    });
    this.updateList();
  }

  mapHashes(hashes) {
    return hashes.map(hash => this.fileObjects.get(hash)).filter(fileObj => fileObj);
  }

  addToList(fileObj: FilesystemObject) {
    if (!fileObj.isDirectory) {
      const {hashId} = fileObj;
      this.fileObjects.set(hashId, fileObj);
      this.addToHashes(hashId);
    }
  }

  deleteFromList({hashId}: FilesystemObject | FilesystemObjectData) {
    this.fileObjects.delete(hashId);
    this.deleteFromHashes(hashId);
  }
}
