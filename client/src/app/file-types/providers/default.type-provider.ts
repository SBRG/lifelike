import { Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';

import { AbstractObjectTypeProvider, AbstractObjectTypeProviderHelper, Exporter } from './base-object.type-provider';

/**
 * A generic file type provider that is returned when we don't know what type of object
 * it is or we don't support it.
 */
@Injectable()
export class DefaultObjectTypeProvider extends AbstractObjectTypeProvider {
  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService) {
    super(abstractObjectTypeProviderHelper);
  }

  handles(object: FilesystemObject): boolean {
    return true;
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'Download',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename);
          }),
        );
      },
    }]);
  }
}
