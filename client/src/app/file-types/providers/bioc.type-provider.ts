import { Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  Exporter,
} from 'app/file-types/providers/base-object.type-provider';
import { SearchType } from 'app/search/shared';
import { MimeTypes } from 'app/shared/constants';


export const BIOC_SHORTHAND = 'BioC';

@Injectable()
export class BiocTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService) {
    super(abstractObjectTypeProviderHelper);
  }


  handles(object: FilesystemObject): boolean {
    return object.mimeType === MimeTypes.BioC;
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: MimeTypes.BioC, shorthand: BIOC_SHORTHAND, name: BIOC_SHORTHAND}),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'BioC',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename.endsWith('.json') ? object.filename : object.filename + '.json');
          }),
        );
      },
    }]);
  }

}
