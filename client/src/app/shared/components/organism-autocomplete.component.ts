import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';

import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, switchMap, tap } from 'rxjs/operators';
import { NgbTypeaheadSelectItemEvent } from '@ng-bootstrap/ng-bootstrap';

import { SharedSearchService } from 'app/shared/services/shared-search.service';
import {
  OrganismAutocomplete,
  OrganismsResult,
} from 'app/interfaces';

@Component({
  selector: 'app-organism-autocomplete',
  templateUrl: './organism-autocomplete.component.html',
  styleUrls: ['./organism-autocomplete.component.scss']
})
export class OrganismAutocompleteComponent implements OnInit {
  @Input() organismTaxId: string;

  @Output() organismPicked = new EventEmitter<OrganismAutocomplete|null>();
  fetchFailed = false;
  isFetching = false;

  organism: OrganismAutocomplete;

  constructor(private search: SharedSearchService) {
  }

  ngOnInit() {
    if (this.organismTaxId) {
      this.search.getOrganismFromTaxId(
        this.organismTaxId
      ).subscribe(
        (response) => this.organism = response
      );
    }
  }

  searcher = (text$: Observable<string>) => text$.pipe(
    debounceTime(300),
    distinctUntilChanged((prev, curr) => prev.toLocaleLowerCase() === curr.toLocaleLowerCase()),
    tap(() => {
      this.isFetching = true;
      this.organismPicked.emit(null);
    }),
    switchMap(q =>
      this.search.getOrganisms(q, 10).pipe(
        tap(() => this.fetchFailed = false),
        catchError(() => {
          this.fetchFailed = true;
          return of([]);
        }),
        map((organisms: OrganismsResult) => organisms.nodes),
      )
    ),
    tap(() => this.isFetching = false),
  )

  formatter = (organism: OrganismAutocomplete) => organism.organism_name;

  notifySelection(event: NgbTypeaheadSelectItemEvent) {
    this.organism = event.item;
    this.organismPicked.emit(event.item);
  }

  clear() {
    this.organism = undefined;
    this.organismPicked.emit(null);
  }
}
