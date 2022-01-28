import { CollectionModel } from './utils/collection-model';
import { ResultQuery } from './schemas/common';

export class ModelList<T> {
  public collectionSize = 0;
  public readonly results = new CollectionModel<T>([], {
    multipleSelection: true,
  });
  public query: ResultQuery | undefined;
}
