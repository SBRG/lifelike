import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'app-annotation-config-table',
  templateUrl: './annotation-config-table.component.html',
  styleUrls: ['./annotation-config-table.component.scss']
})
export class AnnotationConfigurationTableComponent {
  @Input() headers: string[];
  @Input() models: string[];
  @Input() form: FormGroup;
  @Input() fileType: string;

  constructor() {}

  checkboxChange(model, method, otherMethod, event) {
    this.form.get('annotationMethods').get(model).get(method).setValue(event.target.checked);
    this.form.get('annotationMethods').get(model).get(otherMethod).setValue(!event.target.checked);
  }

  excludeReferences(event) {
    this.form.get('excludeReferences').setValue(event.target.checked);
  }
}
