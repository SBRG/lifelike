import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { configureTestSuite } from 'ng-bullet';

import { HighlightSnippetComponent } from './highlight-snippet.component';

describe('HighlightSnippetComponent', () => {
    let instance: HighlightSnippetComponent;
    let fixture: ComponentFixture<HighlightSnippetComponent>;

    let mockSnippet: string;
    let mockEntry1Text: string;
    let mockEntry2Text: string;
    let mockEntry1Type: string;
    let mockEntry2Type: string;
    let mockLegend: Map<string, string[]>;

    configureTestSuite( () => {
        TestBed.configureTestingModule({
            declarations: [ HighlightSnippetComponent ],
            imports: [
                BrowserAnimationsModule
            ]
        });
    });

    beforeEach(() => {
        // Reset mock data before each test
        mockSnippet = 'The quick_brown_fox jumped over the lazy_dog';
        mockEntry1Text = 'quick brown fox';
        mockEntry2Text = 'lazy dog';
        mockEntry1Type = 'Prey';
        mockEntry2Type = 'Hunter';
        mockLegend = new Map<string, string[]>([
            ['Prey', ['#CD5D67', '#410B13']],
            ['Hunter', ['#8FA6CB', '#7D84B2']]
        ]);

        fixture = TestBed.createComponent(HighlightSnippetComponent);
        instance = fixture.componentInstance;

        instance.snippet = mockSnippet;
        instance.entry1Text = mockEntry1Text;
        instance.entry2Text = mockEntry2Text;
        instance.entry1Type = mockEntry1Type;
        instance.entry2Type = mockEntry2Type;
        instance.legend = mockLegend;

        // Seems like ngOnChanges doesn't get called when we assign the inputs above, so call it manually
        instance.ngOnChanges();

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(instance).toBeTruthy();
    });

    it('should wrap key terms with html spans', () => {
        const keyTermSpans = document.getElementById('highlighted-snippets-container').getElementsByTagName('div');

        expect(keyTermSpans.length).toEqual(2);

        const keyTerm1Span = keyTermSpans[0];
        const keyTerm2Span = keyTermSpans[1];

        expect(keyTerm1Span.innerText).toEqual('quick brown fox');
        expect(keyTerm2Span.innerText).toEqual('lazy dog');
    });

    it('should style key term spans with input colors', () => {
        const keyTermSpans = document.getElementById('highlighted-snippets-container').getElementsByTagName('div');

        expect(keyTermSpans.length).toEqual(2);

        const keyTerm1Span = keyTermSpans[0];
        const keyTerm2Span = keyTermSpans[1];

        expect(keyTerm1Span.style.backgroundColor).toEqual('rgba(205, 93, 103, 0.3)');
        expect(keyTerm2Span.style.backgroundColor).toEqual('rgba(143, 166, 203, 0.3)');
    });
});
