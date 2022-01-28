import { Component, EventEmitter, Output, Input, ViewEncapsulation } from '@angular/core';

import { SortingAlgorithm } from './sorting-algorithms';


@Component({
  selector: 'app-sorting-algorithms',
  templateUrl: './sorting-algorithms.component.html',
  styleUrls: ['./sorting-algorithms.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class SortingAlgorithmsComponent {
  @Output() changeSorting = new EventEmitter<SortingAlgorithm>();
  @Input() algorithms;

  @Input() selected: SortingAlgorithm;
}
