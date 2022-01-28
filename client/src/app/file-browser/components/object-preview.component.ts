import {
  AfterViewInit,
  Component,
  ComponentRef,
  Input,
  NgZone,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';

import { BehaviorSubject, of } from 'rxjs';
import { mergeMap } from 'rxjs/operators';

import { ObjectTypeService } from 'app/file-types/services/object-type.service';
import { ErrorHandler } from 'app/shared/services/error-handler.service';

import { FilesystemObject } from '../models/filesystem-object';
import { FilesystemService } from '../services/filesystem.service';

@Component({
  selector: 'app-object-preview',
  templateUrl: './object-preview.component.html',
})
export class ObjectPreviewComponent implements OnChanges {

  @Input() object: FilesystemObject;
  @Input() contentValue: Blob;
  @Input() highlightTerms: string[] | undefined;
  @ViewChild('child', {static: false, read: ViewContainerRef}) viewComponentRef: ViewContainerRef;

  private readonly object$ = new BehaviorSubject<FilesystemObject>(null);
  readonly previewComponent$ = this.object$.pipe(
    mergeMap(object => {
      if (object) {
        const contentValue$ = this.contentValue ? of(this.contentValue) : this.filesystemService.getContent(object.hashId);
        return this.objectTypeService.get(object).pipe(mergeMap(typeProvider => {
          return typeProvider.createPreviewComponent(object, contentValue$, {
            highlightTerms: this.highlightTerms,
          });
        }));
      } else {
        return of(null);
      }
    }),
  );

  constructor(protected readonly filesystemService: FilesystemService,
              protected readonly errorHandler: ErrorHandler,
              protected readonly objectTypeService: ObjectTypeService,
              protected readonly ngZone: NgZone) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if ('object' in changes || 'contentValue' in changes) {
      this.object$.next(this.object);
    }
  }
}

@Component({
  selector: 'app-object-preview-outlet',
  template: `
    <ng-container #child></ng-container>
  `,
})
export class ObjectPreviewOutletComponent implements AfterViewInit {

  @ViewChild('child', {static: false, read: ViewContainerRef}) viewComponentRef: ViewContainerRef;
  private _componentRef: ComponentRef<any>;

  @Input()
  set componentRef(componentRef: ComponentRef<any>) {
    this._componentRef = componentRef;
    if (this.viewComponentRef) {
      this.attach();
    }
  }

  get componentRef(): ComponentRef<any> {
    return this._componentRef;
  }

  ngAfterViewInit(): void {
    this.attach();
  }

  private attach() {
    // Run outside change detection
    // I don't think you're supposed to do it this way
    Promise.resolve(null).then(() => {
      this.viewComponentRef.clear();
      if (this.componentRef) {
        this.viewComponentRef.insert(this.componentRef.hostView);
      }
    });
  }

}
