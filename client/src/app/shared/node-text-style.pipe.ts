import { Pipe, PipeTransform } from '@angular/core';
import { TitleCasePipe } from '@angular/common';

@Pipe({
  name: 'nodeTextStyle'
})
export class NodeTextStylePipe implements PipeTransform {

  transform(value: string, ...args: any[]): any {
    const isUppercase = value === value.toUpperCase();

    if (isUppercase) {
      return value;
    } else {
      const titleCasePipe = new TitleCasePipe();
      return titleCasePipe.transform(value);
    }
  }

}
