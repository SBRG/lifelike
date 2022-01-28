import {
  AfterViewInit,
  ChangeDetectorRef,
  Component, ElementRef, EventEmitter,
  HostListener,
  Input, NgZone, OnChanges, OnDestroy, OnInit, Output,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';

import { Container } from 'app/shared/workspace-manager';

@Component({
  selector: 'app-workspace-outlet',
  template: `
    <ng-container #child></ng-container>`,
})
export class WorkspaceOutletComponent implements AfterViewInit, OnChanges, OnInit, OnDestroy {
  @Input() name: string;
  @Output() outletFocus = new EventEmitter<any>();
  @ViewChild('child', {static: false, read: ViewContainerRef}) viewComponentRef: ViewContainerRef;
  private currentActive = false;
  private previouslyActive = false;
  private currentContainer: Container<any>;

  constructor(private changeDetectorRef: ChangeDetectorRef,
              private ngZone: NgZone,
              private hostElement: ElementRef) {
  }

  ngOnInit() {
    this.ngZone.runOutsideAngular(() => {
      this.hostElement.nativeElement.addEventListener('focusin', this.focusedInside.bind(this), true);
      this.hostElement.nativeElement.addEventListener('click', this.focusedInside.bind(this), true);
    });
  }

  ngOnDestroy(): void {
    this.viewComponentRef.detach();
  }

  get container() {
    return this.currentContainer;
  }

  @Input() set container(container) {
    this.currentContainer = container;
    if (this.active) {
      this.attachComponent();
    }
  }

  get active(): boolean {
    return this.currentActive;
  }

  @Input() set active(active: boolean) {
    this.currentActive = active;
    if (active && !this.previouslyActive) {
      this.previouslyActive = true;
      this.attachComponent();
    }
  }

  ngAfterViewInit(): void {
    if (this.active) {
      this.attachComponent();
    }
  }

  ngOnChanges(): void {
    if (this.active && this.viewComponentRef && this.currentContainer && !this.currentContainer.attached) {
      this.attachComponent();
    }
  }

  private attachComponent(): void {
    if (this.viewComponentRef) {
      this.viewComponentRef.detach();
      if (this.currentContainer) {
        this.currentContainer.attach(this.viewComponentRef);
        this.changeDetectorRef.detectChanges();
      }
    }
  }

  focusedInside() {
    this.outletFocus.emit();
  }

}
