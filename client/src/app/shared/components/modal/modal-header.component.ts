import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-modal-header',
  templateUrl: './modal-header.component.html',
})
export class ModalHeaderComponent {
  @Output() cancel = new EventEmitter<any>();
}
