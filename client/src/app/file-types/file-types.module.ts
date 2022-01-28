import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TYPE_PROVIDER } from './providers/base-object.type-provider';
import { BiocTypeProvider } from './providers/bioc.type-provider';
import { DirectoryTypeProvider } from './providers/directory.type-provider';
import { EnrichmentTableTypeProvider } from './providers/enrichment-table.type-provider';
import { MapTypeProvider } from './providers/map.type-provider';
import { DefaultObjectTypeProvider } from './providers/default.type-provider';
import { PdfTypeProvider } from './providers/pdf.type-provider';
import { GraphTypeProvider } from './providers/graph.type-provider.service';


@NgModule({
  declarations: [],
  imports: [
    CommonModule
  ],
  providers: [
    {
      provide: TYPE_PROVIDER,
      useClass: BiocTypeProvider,
      multi: true,
    },
    DefaultObjectTypeProvider,
    {
      provide: TYPE_PROVIDER,
      useClass: DirectoryTypeProvider,
      multi: true,
    },
    {
      provide: TYPE_PROVIDER,
      useClass: EnrichmentTableTypeProvider,
      multi: true,
    },
    {
      provide: TYPE_PROVIDER,
      useClass: GraphTypeProvider,
      multi: true,
    },
    {
      provide: TYPE_PROVIDER,
      useClass: MapTypeProvider,
      multi: true,
    },
    {
      provide: TYPE_PROVIDER,
      useClass: PdfTypeProvider,
      multi: true,
    }
  ]
})
export class FileTypesModule {
  constructor(@Optional() @SkipSelf() parentModule?: FileTypesModule) {
    if (parentModule) {
      throw new Error(
        'FileTypeModule is already loaded. Import it in the AppModule only');
    }
  }
}
