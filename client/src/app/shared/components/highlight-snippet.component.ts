import { Component, Input, OnChanges } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

import { hexToRGBA } from 'app/shared/utils';

@Component({
  selector: 'app-highlight-snippet',
  templateUrl: './highlight-snippet.component.html',
  styleUrls: ['./highlight-snippet.component.scss']
})
export class HighlightSnippetComponent implements OnChanges {
    @Input() snippet = '';
    @Input() entry1Text = '';
    @Input() entry2Text = '';
    @Input() entry1Type = '';
    @Input() entry2Type = '';
    @Input() legend: Map<string, string[]> = new Map<string, string[]>();

    highlightedSnippet = '';

    trustedHTML: SafeHtml;

    constructor(
        private domSanitizer: DomSanitizer,
    ) { }

    ngOnChanges() {
        const spaceRegex = / /gi;

        // Because the `entryType` properties of snippet nodes DOES NOT match the label of the entity nodes, we do an extra check here.
        // E.g., a snippet associated with a `LiteratureGene` node will have the "gene" as its entry type, not "literaturegene."
        const entry1Colors = this.legend.get(this.entry1Type) || this.legend.get(`Literature${this.entry1Type}`) || ['#000', '#000'];

        const entry1BackgroundColor = entry1Colors[0];
        const entry1StyleString = `
            background-color: ${hexToRGBA(entry1BackgroundColor, 0.3)};
            display: inline-block;
            padding: 0px 1.5px;
            text-align: center;
            vertical-align: middle;
        `;
        const entry1TextJoinedByUnderscore = this.entry1Text.replace(spaceRegex, '_');

        const entry2Colors = this.legend.get(this.entry2Type) || this.legend.get(`Literature${this.entry2Type}`) || ['#000', '#000'];

        const entry2BackgroundColor = entry2Colors[0];
        const entry2StyleString = `
            background-color: ${hexToRGBA(entry2BackgroundColor, 0.3)};
            display: inline-block;
            padding: 0px 1.5px;
            text-align: center;
            vertical-align: middle;
        `;
        const entry2TextJoinedByUnderscore = this.entry2Text.replace(spaceRegex, '_');

        const styleMap = {};
        styleMap[this.entry1Text] = `<div style="${entry1StyleString}">${this.entry1Text}</div>`;
        styleMap[this.entry2Text] = `<div style="${entry2StyleString}">${this.entry2Text}</div>`;
        styleMap[entry1TextJoinedByUnderscore] = `<div style="${entry1StyleString}">${this.entry1Text}</div>`;
        styleMap[entry2TextJoinedByUnderscore] = `<div style="${entry2StyleString}">${this.entry2Text}</div>`;

        this.highlightedSnippet = this.snippet.replace(
          new RegExp(`\\b(${this.entry1Text}|${this.entry2Text}|${entry1TextJoinedByUnderscore}|${entry2TextJoinedByUnderscore})\\b`, 'g'),
          match => {
            return styleMap[match];
          }
        );

        // We have to be VERY careful using this! It could expose our site to XSS attacks if we aren't cautious.
        this.trustedHTML = this.domSanitizer.bypassSecurityTrustHtml(this.highlightedSnippet);
    }
}
