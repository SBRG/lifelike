import { TestBed } from '@angular/core/testing';

import { configureTestSuite } from 'ng-bullet';

import { ContextMenuControlService } from './context-menu-control.service';

describe('ContextMenuControlService', () => {
    let service: ContextMenuControlService;

    configureTestSuite(() => {
        TestBed.configureTestingModule(
            {providers: [ContextMenuControlService]},
        );
    });

    beforeEach(() => {
        // TODO: consider Angular 9?
        // see Note in docs about Testbed.get() not being type safe
        // https://angular.io/guide/testing#angular-testbed
        // Testbed.inject() is Angular 9: https://github.com/angular/angular/issues/34401
        service = TestBed.get(ContextMenuControlService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
