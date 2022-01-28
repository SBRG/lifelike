import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';

import { SidenavNodeEntity } from 'app/interfaces';
import { RootStoreModule } from 'app/root-store';
import { SharedModule } from 'app/shared/shared.module';

import { SidenavNodeViewComponent } from './sidenav-node-view.component';

describe('SidenavNodeViewComponent', () => {
    let component: SidenavNodeViewComponent;
    let fixture: ComponentFixture<SidenavNodeViewComponent>;

    let mockNodeEntity: SidenavNodeEntity;
    let mockLegend: Map<string, string[]>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                BrowserAnimationsModule
            ],
            declarations: [ SidenavNodeViewComponent ]
        });
    });

    beforeEach(() => {
        // Reset mock data before every test so changes don't carry over between tests
        mockNodeEntity = {
            data: {
                data: {id: 'MOCK_NODE_ID', name: 'Mock Node'},
                displayName: 'Mock Node',
                id: 1,
                label: 'Mock Node',
                subLabels: ['MockNode'],
                domainLabels: [],
                expanded: false,
                primaryLabel: 'MockNode',
                color: null,
                font: null,
                entityUrl: null,
            },
            edges: [],
        };

        mockLegend = new Map<string, string[]>([
            ['MockNode', ['#CD5D67', '#410B13']],
        ]);

        fixture = TestBed.createComponent(SidenavNodeViewComponent);
        component = fixture.componentInstance;
        // Make a deep copy of the mock object so we get a brand new one for each test
        component.nodeEntity = mockNodeEntity;
        component.legend = mockLegend;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should show the input node display name', () => {
        const nodeDisplayNameElement = document.getElementById('sidenav-node-display-name');
        expect(nodeDisplayNameElement.innerText).toEqual('Mock Node');
    });

    it('should show the input node label', () => {
        const nodeLabelElement = document.getElementById('sidenav-node-label');
        expect(nodeLabelElement.innerText).toEqual('MockNode');
    });
});
