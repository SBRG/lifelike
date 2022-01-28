import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-base-control',
  templateUrl: './base-control.component.html',
  styleUrls: ['./base-control.component.scss']
})
export class BaseControlComponent {
  @Input() disabled = false;
  @Input() resultIndex = 0;
  @Input() resultCount = 0;

  @Input() searching = false;
  @Output() previous = new EventEmitter<number>();
  @Output() next = new EventEmitter<number>();
  @Output() clear = new EventEmitter();
}
