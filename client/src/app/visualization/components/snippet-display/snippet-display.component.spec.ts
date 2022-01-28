import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';

import {
    AssociationSnippet,
    NewClusterSnippetsPageRequest,
    NewEdgeSnippetsPageRequest,
    Publication,
    Reference,
    SidenavSnippetData,
} from 'app/interfaces';
import { getPubtatorSearchUrl} from 'app/shared/constants';
import { SharedModule } from 'app/shared/shared.module';
import { RootStoreModule } from 'app/root-store';

import { SnippetDisplayComponent } from './snippet-display.component';

describe('SnippetDisplayComponentComponent', () => {
    let component: SnippetDisplayComponent;
    let fixture: ComponentFixture<SnippetDisplayComponent>;

    let mockSidenavSnippetData: SidenavSnippetData;
    let mockAssociationSnippets: AssociationSnippet[];
    let mockPublication: Publication;
    let mockReference: Reference;

    let mockLegend: Map<string, string[]>;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                SharedModule,
                RootStoreModule,
                BrowserAnimationsModule,
            ],
            declarations: [ SnippetDisplayComponent ]
        });
    });

    beforeEach(() => {
        // Reset mock data before every test so changes don't carry over between tests
        mockPublication = {
            id: 3,
            label: 'Mock Publication',
            data: {
                journal: 'Mock Journal',
                title: 'Mock Title',
                pmid: '123456',
                pubYear: 9999,
            },
            subLabels: [],
            displayName: 'Mock Publication Display Name',
         } as Publication;

        mockReference = {
            id: 4,
            label: 'Mock Reference',
            data: {
                entry1Text: 'Mock Entry 1',
                entry1Type: 'mockNode1',
                entry2Text: 'Mock Entry 2',
                entry2Type: 'mockNode2',
                id: 'mockReferenceId1',
                score: 0,
                sentence: 'Mock Sentence',
            },
            subLabels: [],
            displayName: 'Mock Reference Display Name',
            entityUrl: null,
            domainLabels: [],
        } as Reference;

        mockAssociationSnippets = [
            {
                publication: mockPublication,
                reference: mockReference,
            }
        ];

        mockSidenavSnippetData = {
            from: {
                displayName: 'Mock Node 1',
                primaryLabel: 'MockNode1',
                url: null,
            },
            to:
            {
                displayName: 'Mock Node 2',
                primaryLabel: 'MockNode2',
                url: null,
            },
            association: 'Mock Association',
            snippets: mockAssociationSnippets,
        };

        mockLegend = new Map<string, string[]>([
            ['MockNode1', ['#CD5D67', '#410B13']],
            ['MockNode2', ['#8FA6CB', '#7D84B2']],
        ]);

        fixture = TestBed.createComponent(SnippetDisplayComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        component.isNewEntity = true;
        component.totalResults = 1;
        component.snippetData = [mockSidenavSnippetData];
        component.legend = mockLegend;
        component.dataLoaded = true;

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should show loading spinner if data is not loaded', () => {
        component.dataLoaded = false;

        fixture.detectChanges();

        const loadingSpinner = document.getElementById('loading-spinner-container');
        expect(loadingSpinner).toBeTruthy();
    });

    it('should load snippet panels', () => {
        const snippetPanels = document.getElementsByClassName('association-snippet-panel');

        expect(snippetPanels.length).toEqual(1);
    });

    it('should show publication data on snippet panels', () => {
        const snippetPanelTitles = document.getElementsByClassName('snippet-panel-title');
        const snippetPanelPubData = document.getElementsByClassName('snippet-panel-pub-data');

        expect(snippetPanelTitles.length).toEqual(1);
        expect(snippetPanelPubData.length).toEqual(1);

        const title = snippetPanelTitles[0];
        const pubData = snippetPanelPubData[0];

        expect(title.textContent).toEqual('Mock Title');
        expect(pubData.textContent).toEqual('Mock Journal (9999)');
    });

    it('should link to pubtator', () => {
        const snippetPanel = document.getElementsByClassName('snippet-panel-title')[0] as HTMLElement;
        const pubmedLinks = document.getElementsByClassName('pubtator-link');

        snippetPanel.click();

        fixture.detectChanges();

        expect(pubmedLinks.length).toEqual(1);

        const link = pubmedLinks[0];

        expect(link.getAttribute('href')).toEqual(getPubtatorSearchUrl('123456'));
        expect(link.textContent).toEqual('123456');
    });

    it('should show "Showing 0 - 0" of 0" and no page limit selector if there are no results', () => {
        const resultsDisplayContainer = document.getElementById('num-snippets-container');
        component.totalResults = 0;

        fixture.detectChanges();

        expect(resultsDisplayContainer.innerText).toEqual('Showing 0 - 0 of 0 snippets');
    });

    it('should not show buttons if there are less results than the page limit', () => {
        const buttonsContainer = document.getElementById('pagination-button-container');

        component.page = 1;
        component.maxPages = 1;
        component.setPageButtons();

        fixture.detectChanges();

        expect(component.pageButtons).toEqual([]);
        expect(buttonsContainer).toBeFalsy();
    });

    it('previousPage should decrement the page, set buttons, and request new data', () => {
        const requestPageSpy = spyOn(component, 'requestPage');
        const setPageButtonsSpy = spyOn(component, 'setPageButtons');

        component.previousPage();

        expect(component.page).toEqual(0);
        expect(requestPageSpy).toHaveBeenCalled();
        expect(setPageButtonsSpy).toHaveBeenCalled();
    });

    it('nextPage should increment the page, set buttons, and request new data', () => {
        const requestPageSpy = spyOn(component, 'requestPage');
        const setPageButtonsSpy = spyOn(component, 'setPageButtons');

        component.nextPage();

        expect(component.page).toEqual(2);
        expect(requestPageSpy).toHaveBeenCalled();
        expect(setPageButtonsSpy).toHaveBeenCalled();
    });

    it('gotToPage should set the page, set buttons, and request new data', () => {
        const requestPageSpy = spyOn(component, 'requestPage');
        const setPageButtonsSpy = spyOn(component, 'setPageButtons');

        component.goToPage(2);

        expect(component.page).toEqual(2);
        expect(requestPageSpy).toHaveBeenCalled();
        expect(setPageButtonsSpy).toHaveBeenCalled();
    });

    it('setPageButtons should correctly set the number of page buttons based on the current page and max pages', () => {
        component.maxPages = 5;

        component.page = 1;
        component.setPageButtons();
        expect(component.pageButtons).toEqual([2]);

        component.page = 2;
        component.setPageButtons();
        expect(component.pageButtons).toEqual([2, 3]);

        component.page = 3;
        component.setPageButtons();
        expect(component.pageButtons).toEqual([2, 3, 4]);
    });

    it('requestPage should request new data from the parent for selected page', () => {
        const requestNewPageEmitterSpy = spyOn(component.requestNewPageEmitter, 'emit');

        component.requestPage();

        expect(requestNewPageEmitterSpy).toHaveBeenCalledWith(
            {
                queryData: component.queryData,
                page: component.page,
                limit: component.pageLimit,
            } as NewClusterSnippetsPageRequest | NewEdgeSnippetsPageRequest
        );
    });
});
