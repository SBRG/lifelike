import { Directive, ElementRef, Input, OnInit } from '@angular/core';

import * as $ from 'jquery';
import 'jqueryui';
import { isNil } from 'lodash-es';


@Directive({
  selector: '[appResizable]'
})
export class ResizableDirective  implements OnInit {
  @Input() handles = 'n,w,s,e';
  @Input() minHeight = 52;

  el: ElementRef;

  constructor(el: ElementRef) {
    this.el = el;
  }

  ngOnInit() {
    if (isNil(
      this.el.nativeElement
    )) {
      return;
    }

    $(`#${this.el.nativeElement.id}`).resizable({
      handles: this.handles,
      maxWidth: 500,
      minWidth: 256,
      maxHeight: 500,
      minHeight: this.minHeight
    });
  }
}
