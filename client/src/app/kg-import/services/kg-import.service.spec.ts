import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { RootStoreModule } from 'app/root-store';

import { KgImportService } from './kg-import.service';

describe('KgImportService', () => {
    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                RootStoreModule,
            ],
        });
    });

    it('should be created', () => {
        const service: KgImportService = TestBed.get(KgImportService);
        expect(service).toBeTruthy();
    });
});
