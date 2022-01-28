import { AbstractControl } from '@angular/forms';

export function getTopParent(control: AbstractControl) {
  let parent = control;
  while (parent.parent != null) {
    parent = parent.parent;
  }
  return parent;
}

export function objectToFormData(object: object): FormData {
  const formData: FormData = new FormData();
  for (const [key, value] of Object.entries(object)) {
    if (value == null) {
      // Do nothing
    } else if (value instanceof Blob) {
      // Handle file upload
      formData.append(key, value);
    } else if (typeof value === 'boolean') {
      formData.append(key, value ? 'true' : 'false');
    } else if (typeof value === 'object') {
      throw new Error('cannot put an object value into a FormData');
    } else {
      formData.append(key, String(value));
    }
  }
  return formData;
}

export function objectToMixedFormData(object: object): FormData {
  const data = {};
  const formData: FormData = new FormData();
  for (const [key, value] of Object.entries(object)) {
    if (value instanceof Blob) {
      formData.append(key, value);
    } else {
      data[key] = value;
    }
  }
  formData.append('json$', JSON.stringify(data));
  return formData;
}
