import { Directive, ElementRef, Input, OnDestroy, OnInit } from '@angular/core';

import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

@Directive({
  selector: '[appContainerBreakpoints]',
})
export class ContainerBreakpointsDirective implements OnInit, OnDestroy {
  private _queryDelay = 50;
  protected readonly classPrefix = 'cbp';
  protected readonly resizes$ = new Subject<any>();
  // @ts-ignore
  protected readonly observer = new ResizeObserver(() => this.resizes$.next());
  protected readonly breakpoints = Object.freeze({
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
  });
  private resizeSubscription: Subscription;

  constructor(protected readonly element: ElementRef) {
    element.nativeElement.classList.add(this.classPrefix);
  }

  ngOnInit() {
    this.applyStyleClasses();
    this.observer.observe(this.element.nativeElement);
    this.registerSubscription();
  }

  ngOnDestroy() {
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
    this.observer.disconnect();
  }

  private registerSubscription() {
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
    this.resizeSubscription = this.resizes$
      .pipe(debounceTime(this._queryDelay))
      .subscribe(() => this.applyStyleClasses());
  }

  private applyStyleClasses() {
    const element = this.element.nativeElement as HTMLElement;
    const width = element.getBoundingClientRect().width;
    for (const key of Object.keys(this.breakpoints)) {
      const breakpointClass = `${this.classPrefix}-${key}`;
      if (width >= this.breakpoints[key]) {
        element.classList.add(breakpointClass);
      } else {
        element.classList.remove(breakpointClass);
      }
    }
  }

  get queryDelay(): number {
    return this._queryDelay;
  }

  @Input()
  set queryDelay(ms: number) {
    this._queryDelay = ms;
    this.registerSubscription();
  }
}
