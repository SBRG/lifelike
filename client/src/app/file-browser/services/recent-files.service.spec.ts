import { TestBed, async } from '@angular/core/testing';

import { Observable, of } from 'rxjs';

import { mockStorage } from 'app/shared/mocks/storage.spec';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { MockErrorHandler } from 'app/shared/mocks/error-handler.spec';
import { uuidv4 } from 'app/shared/utils';
import { MimeTypes } from 'app/shared/constants';

import { FilesystemService } from './filesystem.service';
import { RecentFilesService } from './recent-files.service';
import { FilesystemObject } from '../models/filesystem-object';

describe('RecentFileService', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      providers: [
        // overwrite RecentFilesService provider to not use singleton
        {provide: RecentFilesService, useClass: RecentFilesService},
        {provide: ErrorHandler, useClass: MockErrorHandler},
        {provide: FilesystemService, useClass: class {
            get(hashId: string, updateRecent?): Observable<FilesystemObject> {
              const fileObj = new FilesystemObject();
              fileObj.update({
                mimeType: MimeTypes.Pdf,
                hashId
              });
              return of(fileObj);
            }
          }
        }
      ]
    })
      .compileComponents();
  }));

  it('Create an instance', () => {
    mockStorage(localStorage);
    const service = TestBed.inject(RecentFilesService);
    expect(service).toBeTruthy();
  });

  it('Does not crash while saving circular object', done => {
    mockStorage(localStorage);
    const service = TestBed.inject(RecentFilesService);
    // create circular obj
    const a = {};
    // @ts-ignore
    a.b = {a};
    // set it internally in service
    // @ts-ignore
    service._hashes.next([a]);
    service.hashes.subscribe(hashes => {
      expect(hashes).toEqual([]);
      done();
    });
  });

  it('Adds hash', done => {
    mockStorage(localStorage);
    const service = TestBed.inject(RecentFilesService);
    const hash = 'Adds hash';
    service.addToHashes(hash);
    service.hashes.subscribe(hashes => {
      expect(hashes).toEqual([hash]);
      done();
    });
  });

  it('Hashes are fetched', done => {
    const mockHashes = ['Hashes are fetched'];
    mockStorage(localStorage, {
      // @ts-ignore
      [RecentFilesService.RECENT_KEY]: JSON.stringify(mockHashes)
    });
    const service = TestBed.inject(RecentFilesService);
    service.hashes.subscribe(hashes => {
      expect(hashes).toEqual(mockHashes);
      done();
    });
  });

  describe('Hashes are ignored if are not correct', () => {
    [{}, null, undefined, NaN, Math.random(), 0, uuidv4()].forEach(mockHashes => {
      it(`Testing Value: ${mockHashes}`, done => {
          mockStorage(localStorage, {
            // @ts-ignore
            [RecentFilesService.RECENT_KEY]: mockHashes
          });
          const service = TestBed.inject(RecentFilesService);
          service.hashes.subscribe(hashes => {
            expect(hashes).toEqual([]);
            done();
          });
        }
      );
    });
  });

  xit('Reacts to storage event', done => {
    const storage = mockStorage(localStorage);
    const service = TestBed.inject(RecentFilesService);
    const mockHashes = ['Reacts to storage event'];
    let count = 0;
    const expectedOutput = [
      [],
      mockHashes
    ];
    service.hashes.subscribe(hashes => {
      expect(hashes).toEqual(expectedOutput[count]);
      count++;
      if (count === expectedOutput.length) {
        done();
      }
    });
    const mockHashesJSON = JSON.stringify(mockHashes);
    const storageEvent = new StorageEvent('storage', {
      key: RecentFilesService.RECENT_KEY,
      newValue: mockHashesJSON,
      storageArea: localStorage,
    });
    storage.setItem(RecentFilesService.RECENT_KEY, mockHashesJSON);
    window.dispatchEvent(storageEvent);
  });
});
