import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

import { WordCloudAnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';

import { AnnotationFilterComponent } from '../annotation-filter/annotation-filter.component';

@Component({
  selector: 'app-word-cloud-annotation-filter',
  templateUrl: './word-cloud-annotation-filter.component.html',
  styleUrls: ['./word-cloud-annotation-filter.component.scss']
})
export class WordCloudAnnotationFilterComponent extends AnnotationFilterComponent<WordCloudAnnotationFilterEntity> implements OnInit {
  @Input() clickableWords = false;
  @Output() wordOpen = new EventEmitter<WordCloudAnnotationFilterEntity>();

  constructor() {
    super();
  }

  ngOnInit() {
    super.ngOnInit();
  }
}
