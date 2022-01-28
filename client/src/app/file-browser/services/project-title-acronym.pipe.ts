import { Pipe, PipeTransform } from '@angular/core';

import { isNil } from 'lodash-es';

@Pipe({
  name: 'projectTitleAcronym'
})
export class ProjectTitleAcronymPipe implements PipeTransform {

  transform(value: string, ...args: any[]): any {
    if (isNil(value)) { return ''; }

    const acronymLength = args.length ? args[0] : 2;

    // split by multiple delimiters like dash and space
    let tokens = value.split(/[\s-_,]+/);
    // only keep the first two tokens
    tokens = tokens.splice(0, acronymLength);

    // Get first letter of each of token, fuse, and uperrcase
    return tokens.map(t => t.charAt(0)).join('').toUpperCase();
  }

}
