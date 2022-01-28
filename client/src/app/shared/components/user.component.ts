import { Component, Input } from '@angular/core';

import { AppUser } from 'app/interfaces';

@Component({
  selector: 'app-user',
  template: `
    <ng-container *ngIf="user; else noUser">
      <span [ngbPopover]="infoPopover" popoverTitle="User Information" triggers="hover"
            container="body">
        <ng-container *ngIf="highlightTerms && highlightTerms.length; else noHighlight">
          <app-term-highlight [text]="user.firstName + ' ' + user.lastName"
                              [highlightTerms]="highlightTerms"
                              [highlightOptions]="{wholeWord: true}"></app-term-highlight>
        </ng-container>
        <ng-template #noHighlight>{{ user.firstName }} {{ user.lastName }}</ng-template>
      </span>
    </ng-container>
    <ng-template #noUser>
      <em>Unknown</em>
    </ng-template>
    <ng-template #infoPopover>
      <strong>Username:</strong> {{ user.username }}
    </ng-template>
  `,
})
export class UserComponent {

  @Input() user: AppUser;
  @Input() highlightTerms: string[] = [];

}
