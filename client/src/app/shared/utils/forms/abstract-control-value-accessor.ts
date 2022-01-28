import { ControlValueAccessor } from '@angular/forms';

export abstract class AbstractControlValueAccessor<T> implements ControlValueAccessor {

  value: T = this.getDefaultValue();
  private changeCallback: any;
  private touchCallback: any;

  abstract getDefaultValue(): T;

  valueChange() {
    if (this.changeCallback) {
      this.changeCallback(this.value);
    }
  }

  controlBlur() {
    if (this.touchCallback) {
      this.touchCallback();
    }
  }

  clear() {
    this.value = this.getDefaultValue();
    this.valueChange();
    this.focus();
  }

  focus() {
  }

  select() {
  }

  registerOnChange(fn): void {
    this.changeCallback = fn;
  }

  registerOnTouched(fn): void {
    this.touchCallback = fn;
  }

  writeValue(value: T): void {
    this.value = value;
  }

}
