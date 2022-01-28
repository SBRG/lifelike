import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-search-control',
  templateUrl: './search-control.component.html',
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: SearchControlComponent,
    multi: true,
  }],
})
export class SearchControlComponent implements ControlValueAccessor {

  value = '';
  private changeCallback: any;
  private touchCallback: any;

  @Input() disabled = false;
  @Input() resultIndex = 0;
  @Input() resultCount = 0;

  @Input() searching = false;
  @Output() previous = new EventEmitter<number>();
  @Output() next = new EventEmitter<number>();
  @Output() enterPress = new EventEmitter();
  @Output() valueClear = new EventEmitter();

  @ViewChild('searchInput', {static: false}) searchElement: ElementRef;

  changed() {
    if (this.changeCallback) {
      this.changeCallback(this.value);
    }
  }

  private setValue(value: string) {
    if (value !== this.value) {
      this.value = value;
      this.changed();
    }
  }

  get searchInputWidth() {
    if (this.value) {
      // width = font_width * ~font_proportions + padding
      // return `calc(${this.value.length * 0.55}em + 20px)`;
      // cannot use calc without bypassing Angular security
      // https://angular.io/api/platform-browser/DomSanitizer
      // using hardcoded font size instead
      return Math.max(70, Math.min(150, 14 * this.value.length * 0.55 + 20)) + 'px';
    } else {
      return '70px';
    }
  }

  blurred() {
    this.setValue(this.searchElement.nativeElement.value);
    if (this.touchCallback) {
      this.touchCallback();
    }
  }

  clear() {
    this.setValue('');
    this.focus();
    this.valueClear.emit();
  }

  registerOnChange(fn): void {
    this.changeCallback = fn;
  }

  registerOnTouched(fn): void {
    this.touchCallback = fn;
  }

  writeValue(value): void {
    this.value = value;
  }

  focus() {
    this.searchElement.nativeElement.focus();
  }

  select() {
    this.searchElement.nativeElement.select();
  }

  inputKeyUp(event: KeyboardEvent) {
    const newValue = this.searchElement.nativeElement.value;
    if (event.key === 'Enter') {
      this.enterPress.next();
      if (newValue === this.value) {
        this.next.next();
      } else {
        this.setValue(newValue);
      }
    }
  }
}
