import { Injectable, Injector } from '@angular/core';

import { Observable, of } from 'rxjs';

import { FilesystemObject } from 'app/file-browser/models/filesystem-object';

import { ObjectTypeProvider, TYPE_PROVIDER } from '../providers/base-object.type-provider';
import { DefaultObjectTypeProvider } from '../providers/default.type-provider';

/**
 * The object type service returns object type providers for given objects.
 */
@Injectable()
export class ObjectTypeService {
  constructor(protected readonly injector: Injector,
              private readonly defaultProvider: DefaultObjectTypeProvider) {
  }

  /**
   * Get the provider for the given file.
   * @param object the object
   * @return  a provider, which may be the default one
   */
  get(object: FilesystemObject): Observable<ObjectTypeProvider> {
    const providers = this.injector.get(TYPE_PROVIDER);
    for (const provider of providers) {
      if (provider.handles(object)) {
        return of(provider);
      }
    }
    return of(this.defaultProvider);
  }

  /**
   * Load all providers.
   */
  all(): Observable<ObjectTypeProvider[]> {
    return of(this.injector.get(TYPE_PROVIDER));
  }

  getDefault(): Observable<ObjectTypeProvider> {
    return of(this.defaultProvider);
  }
}
