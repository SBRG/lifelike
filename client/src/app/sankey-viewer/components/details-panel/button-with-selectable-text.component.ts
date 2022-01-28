import { Component, Input, } from '@angular/core';

import { SankeyDetailsComponent } from './details.component';

@Component({
  selector: 'app-button-with-selectable-text',
  templateUrl: './button-with-selectable-text.component.html',
  styleUrls: ['./button-with-selectable-text.component.scss']
})
// @ts-ignore
export class ButtonWithSelectableTextComponent extends SankeyDetailsComponent {
  @Input() disabled;
}
