import { Directive, HostListener, Input } from '@angular/core';

import { URIData, GenericDataProvider } from '../providers/data-transfer-data/generic-data.provider';

@Directive({
  selector: '[appDataTransferData]',
})
export class DataTransferDataDirective {

  @Input() uriData: URIData[] = [];

  @HostListener('dragstart', ['$event'])
  dragStart(event: DragEvent) {
    GenericDataProvider.setURIs(event.dataTransfer, this.uriData, {action: 'append'});
  }

  @HostListener('cut', ['$event'])
  cut(event: ClipboardEvent) {
    // Note: Due to browser security policies, the following line only works if something
    // else in our app has implemented a custom cut handler that calls event.preventDefault()
    GenericDataProvider.setURIs(event.clipboardData, this.uriData, {action: 'append'});
  }

  @HostListener('copy', ['$event'])
  copy(event: ClipboardEvent) {
    // Note: Due to browser security policies, the following line only works if something
    // else in our app has implemented a custom copy handler that calls event.preventDefault()
    GenericDataProvider.setURIs(event.clipboardData, this.uriData, {action: 'append'});
  }

}
