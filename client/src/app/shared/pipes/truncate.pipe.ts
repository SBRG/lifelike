import { Pipe, PipeTransform } from '@angular/core';

import { isNil, isString } from 'lodash-es';

@Pipe({
  name: 'truncate'
})
export class TruncatePipe implements PipeTransform {
  transform(value: string, limit = 20, ellipsis = '...'): string {
    if (isNil(value)) {
      return '';
    } else if (!isString(value)) {
      value = String(value);
    }
    // limit: What length of the text to limit to depending on the
    // length of the text.
    // ellipsis: Whether to use ellipsis supplied in argument or trailing dots
    return value.length > limit ? value.substring(0, limit) + ellipsis : value;
  }
}
