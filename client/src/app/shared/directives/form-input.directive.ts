import {
  AfterContentChecked,
  AfterViewChecked,
  Directive,
  HostBinding,
  Input,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';

import { getTopParent } from '../utils/forms';

/**
 * Implements shared properties of an input.
 */
@Directive({
  selector: '[appFormInput]',
})
export class FormInputDirective implements AfterContentChecked {
  @Input() appFormInput: AbstractControl | undefined;
  @HostBinding('class.is-invalid') invalid = false;
  @HostBinding('class.form-control') formControl = true;

  ngAfterContentChecked() {
    this.invalid = this.appFormInput
      && (this.appFormInput.dirty || getTopParent(this.appFormInput).dirty)
      && this.appFormInput.invalid;
  }
}
