import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';

import { hexToRGBA } from '../utils';

@Component({
  selector: 'app-result-control',
  templateUrl: './result-control.component.html',
})
export class ResultControlComponent {

  @Input() value;
  @Input() disabled = false;
  @Input() resultIndex = 0;
  @Input() resultCount = 0;
  @Input() annotationColor: string = null;
  @Output() valueClear = new EventEmitter<any>();
  @Output() previous = new EventEmitter<number>();
  @Output() next = new EventEmitter<number>();
  @Output() enterPress = new EventEmitter();

  @ViewChild('searchInput', {static: false}) searchElement: ElementRef;

  clear() {
    this.valueClear.emit();
  }

  writeValue(value): void {
    this.value = value;
  }

  focus() {
    this.searchElement.nativeElement.focus();
  }

  select() {
  }

  getAnnotationBackgroundColor(color: string) {
    return hexToRGBA(color, 0.3);
  }
}
