import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-percent-input',
  templateUrl: './percent-input.component.html'
})
export class PercentInputComponent {
  @Input() inputId;
  @Input() value;
  @Output() valueChange = new EventEmitter<number | undefined>();
  @Input() default = '';
  @Input() min: number | undefined;
  @Input() max: number | undefined;
  @Input() step: number | undefined;

  changed(event) {
    const newValue = parseInt(event.target.value, 10) / 100;
    if (newValue !== this.value) {
      this.value = newValue;
      this.valueChange.emit(this.value);
    }
  }
}
