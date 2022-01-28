import { Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  AbstractObjectTypeProvider, AbstractObjectTypeProviderHelper,
  Exporter,
} from 'app/file-types/providers/base-object.type-provider';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { SearchType } from 'app/search/shared';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { MimeTypes } from 'app/shared/constants';

@Injectable()
export class PdfTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService) {
    super(abstractObjectTypeProviderHelper);
  }


  handles(object: FilesystemObject): boolean {
    return object.mimeType === 'application/pdf';
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: MimeTypes.Pdf, shorthand: PDF_SHORTHAND, name: 'Documents'}),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([{
      name: 'PDF',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename.endsWith('.pdf') ? object.filename : object.filename + '.pdf');
          }),
        );
      },
    }]);
  }

}

export const PDF_SHORTHAND = 'pdf';
