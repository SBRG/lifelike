import {
  Directive,
  ElementRef,
  Renderer2,
  Input,
  Injector,
  ComponentFactoryResolver,
  ViewContainerRef,
  NgZone,
  ChangeDetectorRef,
  ApplicationRef,
  OnDestroy,
  OnInit,
  AfterContentChecked,
  HostListener
} from '@angular/core';

import { NgbTooltip, NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs';

import { createResizeObservable } from '../rxjs/resize-observable';

/**
 * Show tooltip only if text offloads
 */
@Directive({
  // tslint:disable-next-line:directive-selector
  selector: '.text-truncate'
})
// @ts-ignore
export class TextTruncateDirective extends NgbTooltip implements OnInit, OnDestroy, AfterContentChecked {
  constructor(
    protected _elementRef: ElementRef<HTMLElement>,
    protected _renderer: Renderer2,
    protected injector: Injector,
    protected componentFactoryResolver: ComponentFactoryResolver,
    protected viewContainerRef: ViewContainerRef,
    protected config: NgbTooltipConfig,
    protected _ngZone: NgZone,
    protected _changeDetector: ChangeDetectorRef,
    protected applicationRef: ApplicationRef
  ) {
    super(
      _elementRef,
      _renderer,
      injector,
      componentFactoryResolver,
      viewContainerRef,
      config,
      _ngZone,
      document,
      _changeDetector,
      applicationRef
    );
    this.resizeSubscription = createResizeObservable(this._elementRef.nativeElement).subscribe(() => {
      this.resized = true;
      this.onResize();
    });
    this.onResize();
  }

  private resized;

  resizeSubscription: Subscription;
  container = 'body';

  @Input() set title(title) {
    this.ngbTooltip = title;
  }

  @Input() set titlePlacement(placement) {
    this.placement = placement;
  }

  @Input() set titleContainer(container) {
    this.container = container;
  }

  ngOnInit() {
    super.ngOnInit();
  }

  onResize() {
    const {scrollWidth, offsetWidth} = this._elementRef.nativeElement;
    this.disableTooltip = scrollWidth <= offsetWidth;
  }

  ngAfterContentChecked() {
    this.ngbTooltip = super.ngbTooltip || (this._elementRef && this._elementRef.nativeElement.innerText) || undefined;
  }

  ngOnDestroy() {
    if (this.resizeSubscription) {
      this.resizeSubscription.unsubscribe();
    }
    super.ngOnDestroy();
  }

  @HostListener('window:scroll')
  @HostListener('scroll')
  onScroll() {
    this.close();
  }
}
