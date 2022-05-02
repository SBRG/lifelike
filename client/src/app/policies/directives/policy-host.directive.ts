import { Directive, ViewContainerRef } from '@angular/core';

@Directive({
  selector: '[appPolicyHost]'
})
export class PolicyHostDirective {
  constructor(public viewContainerRef: ViewContainerRef) { }
}
