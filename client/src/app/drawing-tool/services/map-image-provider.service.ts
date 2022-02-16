import { Injectable } from '@angular/core';

import { Observable, of, Subject, from } from 'rxjs';

import { ResourceProvider } from 'app/graph-viewer/utils/resource/resource-manager';
import { SizeUnits } from 'app/shared/constants';

@Injectable()
export class MapImageProviderService implements ResourceProvider<string, CanvasImageSource> {

  private readonly preloadedUrls = new Map<string, string>();
  private readonly downsizingFactor = 0.5;
  private readonly downsizeIfLargerThanImageSize = SizeUnits.KiB * 500;
  private readonly imageQuality: 0.8;

  constructor() {
  }

  setMemoryImage(id: string, url: string) {
    this.preloadedUrls.set(id, url);
  }

  /**
   * After-upload image functionality. Responsible for retrieving img dimensions, downsizing
   * if necessary and seting it in memory.
   * @param id - image id
   * @param file - image file
   * returns: observable of the image dimensions
   */
  doInitialProcessing(id: string, file: File): Observable<Dimensions> {
    let url = URL.createObjectURL(file);
    return new Observable( subscriber => {
      const img = new Image();
      img.src = url;
      img.onload = () => {
        let {height, width} = img;
        if (file.size > this.downsizeIfLargerThanImageSize) {
          height *= this.downsizingFactor;
          width *= this.downsizingFactor;
          const elem = document.createElement('canvas');
          elem.width = width;
          elem.height = height;
          const ctx = elem.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          url = ctx.canvas.toDataURL(file.type, this.imageQuality);
        }
        this.setMemoryImage(id, url);
        subscriber.next({height, width});
       };
     });
  }

  get(id: string): Observable<CanvasImageSource> {
    const preloadedUrl = this.preloadedUrls.get(id);
    if (preloadedUrl != null) {
      const subject = new Subject<CanvasImageSource>();
      const image = new Image();
      image.onload = () => {
        subject.next(image);
      };
      image.src = preloadedUrl;
      return subject;
    } else {
      // TODO: Return an error to be handled
      return of(null);
    }
  }

  getBlob(id: string): Observable<Blob> {
    const preloadedUrl = this.preloadedUrls.get(id);
    if (preloadedUrl != null) {
      return from(fetch(preloadedUrl).then(r => r.blob()));
    } else {
      // TODO: Return an error to be handled
      return of(null);
    }
  }
}

export interface Dimensions {
  width: number;
  height: number;
}
