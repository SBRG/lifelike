import { Component, Input } from '@angular/core';

import { OrganismAutocomplete } from 'app/interfaces';

@Component({
  selector: 'app-organism',
  template: `
    <ng-container *ngIf="organism; else noOrganism">
      <span [ngbPopover]="infoPopover" popoverTitle="Organism Information" triggers="hover"
            container="body">
        <ng-container *ngIf="highlightTerms && highlightTerms.length; else noHighlight">
          <app-term-highlight [text]="organism.organism_name"
                              [highlightTerms]="highlightTerms"
                              [highlightOptions]="{wholeWord: true}"></app-term-highlight>
        </ng-container>
        <ng-template #noHighlight>{{ organism.organism_name }}</ng-template>
      </span>
    </ng-container>
    <ng-template #noOrganism>
      <em>None</em>
    </ng-template>
    <ng-template #infoPopover>
      <strong>Synonym:</strong> {{ organism.synonym }}
    </ng-template>
  `,
})
export class OrganismComponent {

  @Input() organism: OrganismAutocomplete | undefined;
  @Input() highlightTerms: string[] = [];

}
