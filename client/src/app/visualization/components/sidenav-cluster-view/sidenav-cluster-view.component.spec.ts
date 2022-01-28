import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';
import { MockComponents } from 'ng-mocks';

import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/root-store';

import { SidenavClusterViewComponent } from './sidenav-cluster-view.component';
import { SnippetDisplayComponent } from '../snippet-display/snippet-display.component';

describe('SidenavClusterViewComponent', () => {
    let component: SidenavClusterViewComponent;
    let fixture: ComponentFixture<SidenavClusterViewComponent>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                BrowserAnimationsModule
            ],
            declarations: [
                SidenavClusterViewComponent ,
                MockComponents(
                    SnippetDisplayComponent,
                ),
            ]
        });
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(SidenavClusterViewComponent);
        component = fixture.componentInstance;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should emit to parent when requestPage is called', () => {
        const requestNewPageEmitterSpy = spyOn(component.requestNewPageEmitter, 'emit');

        // Don't care what the data from the child was, we just care that we carry the request to the parent
        component.requestPage(null);

        expect(requestNewPageEmitterSpy).toHaveBeenCalled();
    });
});
