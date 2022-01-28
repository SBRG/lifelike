import { Injectable, OnDestroy } from '@angular/core';

import { Observable } from 'rxjs';
import { tap, shareReplay, map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { BulkObjectUpdateRequest } from 'app/file-browser/schema';

const openEnrichmentFiles = new Map();

@Injectable()
export class EnrichmentService implements OnDestroy {
  constructor(protected readonly filesystemService: FilesystemService) {
  }

  getFileRef(hashId: string) {
    let openFile = openEnrichmentFiles.get(hashId);
    if (!openFile) {
      openFile = {
        // metadata can be mutated (example params edit)
        get: this.filesystemService.get(hashId).pipe(/*map(Object.freeze),*/ shareReplay(1)),
        // data is not mutable
        getContent: this.filesystemService.getContent(hashId).pipe(map(Object.freeze), shareReplay(1)),
        ref: new Set()
      };
      openEnrichmentFiles.set(hashId, openFile);
    }
    openFile.ref.add(this);
    return openFile;
  }

  get(hashId: string): Observable<FilesystemObject> {
    return this.getFileRef(hashId).get;
  }

  getContent(hashId: string): Observable<Blob> {
    return this.getFileRef(hashId).getContent;
  }

  ngOnDestroy() {
    openEnrichmentFiles.forEach((file, hashId, fileMap) =>
      file.ref.delete(this) && !file.ref.size && fileMap.delete(hashId)
    );
  }

  save(hashIds: string[], changes: Partial<BulkObjectUpdateRequest>,
       updateWithLatest?: { [hashId: string]: FilesystemObject }):
    Observable<{ [hashId: string]: FilesystemObject }> {
    return this.filesystemService.save(hashIds, changes, updateWithLatest).pipe(tap(ret =>
        // dump keep track of file upon save so it reloaded
        // todo: implement optimistic update
        hashIds.forEach(hashId => openEnrichmentFiles.delete(hashId)
      )));
  }
}
