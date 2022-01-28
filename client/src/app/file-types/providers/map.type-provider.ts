import {ComponentFactory, ComponentFactoryResolver, Injectable, Injector} from '@angular/core';

import {from, Observable, of} from 'rxjs';
import {map} from 'rxjs/operators';
import JSZip from 'jszip';

import { MapComponent } from 'app/drawing-tool/components/map.component';
import { UniversalGraph } from 'app/drawing-tool/services/interfaces';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { ObjectCreationService } from 'app/file-browser/services/object-creation.service';
import {
  AbstractObjectTypeProvider,
  AbstractObjectTypeProviderHelper,
  CreateActionOptions,
  CreateDialogAction,
  Exporter,
  PreviewOptions
} from 'app/file-types/providers/base-object.type-provider';
import { SearchType } from 'app/search/shared';
import { RankedItem } from 'app/shared/schemas/common';
import { mapBlobToBuffer, mapBufferToJson } from 'app/shared/utils/files';
import { MimeTypes } from 'app/shared/constants';
import { MapImageProviderService } from 'app/drawing-tool/services/map-image-provider.service';


@Injectable()
export class MapTypeProvider extends AbstractObjectTypeProvider {

  constructor(abstractObjectTypeProviderHelper: AbstractObjectTypeProviderHelper,
              protected readonly filesystemService: FilesystemService,
              protected readonly injector: Injector,
              protected readonly objectCreationService: ObjectCreationService,
              protected readonly componentFactoryResolver: ComponentFactoryResolver,
              protected readonly mapImageProviderService: MapImageProviderService) {
    super(abstractObjectTypeProviderHelper);
  }

  handles(object: FilesystemObject): boolean {
    return object.mimeType === MimeTypes.Map;
  }

  unzipContent(contentValue: Blob) {
    const imageIds: string[] = [];
    const imageProms: Promise<Blob>[] = [];
    return from((async () => {
      const unzipped = await JSZip.loadAsync(contentValue).then(zip => {
        const imageFolder = zip.folder('images');
        imageFolder.forEach(f => {
          imageIds.push(f.substring(0, f.indexOf('.')));
          imageProms.push(imageFolder.file(f).async('blob'));
        });
        return zip.files['graph.json'].async('text').then(text => text);
      });

      await Promise.all(imageProms).then((imageBlobs: Blob[]) => {
        for (let i = 0; i < imageIds.length; i++) {
          this.mapImageProviderService.setMemoryImage(imageIds[i], URL.createObjectURL(imageBlobs[i]));
        }
      });
      return unzipped;
    })());
  }

  createPreviewComponent(object: FilesystemObject, contentValue$: Observable<Blob>,
                         options?: PreviewOptions) {
    return contentValue$.pipe(
      map(contentValue => {
        const factory: ComponentFactory<MapComponent<any>> =
          this.componentFactoryResolver.resolveComponentFactory(MapComponent);
        const componentRef = factory.create(this.injector);
        const instance: MapComponent = componentRef.instance;
        instance.highlightTerms = options ? options.highlightTerms : null;
        instance.map = object;
        instance.contentValue = contentValue;
        return componentRef;
      }),
    );
  }

  getCreateDialogOptions(): RankedItem<CreateDialogAction>[] {
    return [{
      rank: 100,
      item: {
        label: 'Map',
        openSuggested: true,
        create: (options?: CreateActionOptions) => {
          const object = new FilesystemObject();
          object.filename = '';
          object.mimeType = MimeTypes.Map;
          object.parent = options.parent;
          const zip = new JSZip();
          zip.file('graph.json', JSON.stringify({edges: [], nodes: []}));
          return zip.generateAsync({ type: 'blob' }).then((content) => {
            return this.objectCreationService.openCreateDialog(object, {
              title: 'New Map',
              request: {
                contentValue: content
              },
              ...(options.createDialog || {}),
            });
          });
        },
      },
    }];
  }

  getSearchTypes(): SearchType[] {
    return [
      Object.freeze({id: MimeTypes.Map, shorthand: 'map', name: 'Maps'}),
    ];
  }

  getExporters(object: FilesystemObject): Observable<Exporter[]> {
    return of([...(
      ['pdf', 'png', 'svg'].map(format => ({
        name: format.toUpperCase(),
        export: (exportLinked) => {
          return this.filesystemService.generateExport(object.hashId, {format, exportLinked}).pipe(
            map(blob => {
              return new File([blob], object.filename + '.' + format);
            }),
          );
        },
      }))
    ), {
      name: 'Lifelike Map File',
      export: () => {
        return this.filesystemService.getContent(object.hashId).pipe(
          map(blob => {
            return new File([blob], object.filename + '.map');
          }),
        );
      },
    },  ...(['Gene', 'Chemical'].map(type => ({
      name: `${type} List`,
      export: () => {
        return this.filesystemService.getMapContent(object.hashId).pipe(
          mapBlobToBuffer(),
          mapBufferToJson<UniversalGraph>(),
          map(graph => {
            const blob = new Blob([
              graph.nodes.filter(node => node.label === type.toLowerCase()).map(node => node.display_name).join('\r\n')
            ], {
              type: 'text/plain',
            });
            return new File([blob], object.filename + ` (${type}s).txt`);
          }),
        );
      },
    })))]);
  }
}
