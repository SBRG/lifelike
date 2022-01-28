import { Pipe, PipeTransform } from '@angular/core';

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const monthNames = [
        'January', 'February', 'March',
        'April', 'May', 'June', 'July',
        'August', 'September', 'October',
        'November', 'December'
    ];

    const day = date.getDate();
    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    return monthNames[monthIndex] + ' ' + day +  ', ' + year;
}

@Pipe({
  name: 'friendlyDateStr'
})
export class FriendlyDateStrPipe implements PipeTransform {

  transform(value: any, ...args: any[]): any {
    return formatDate(value);
  }

}
