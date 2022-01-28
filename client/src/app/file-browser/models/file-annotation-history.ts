import { startCase } from 'lodash-es';

import { CollectionModel } from 'app/shared/utils/collection-model';
import { ModelList } from 'app/shared/models';
import { AnnotationChangeExclusionMeta, Meta } from 'app/pdf-viewer/annotation-type';
import { AppUser } from 'app/interfaces';

import {
  AnnotationChangeData,
  AnnotationExclusionChangeData,
  AnnotationInclusionChangeData,
  FileAnnotationChangeData,
  FileAnnotationHistoryResponse,
} from '../schema';

class AnnotationChange {
  action: 'added' | 'removed';

  /**
   * Get a friendly label describing this change.
   */
  get label(): string {
    return startCase(this.action);
  }

  update(data: AnnotationChangeData): AnnotationChange {
    this.action = data.action;
    return this;
  }
}

/**
 * A change in annotation inclusions.
 */
export class AnnotationInclusionChange extends AnnotationChange {
  meta: Meta;

  update(data: AnnotationInclusionChangeData): AnnotationInclusionChange {
    super.update(data);
    this.meta = data.meta;
    return this;
  }
}

/**
 * A change in annotation exclusions.
 */
export class AnnotationExclusionChange extends AnnotationChange {
  meta: AnnotationChangeExclusionMeta;

  update(data: AnnotationExclusionChangeData): AnnotationExclusionChange {
    super.update(data);
    this.meta = data.meta;
    return this;
  }
}

/**
 * A group of annotations change made together.
 */
export class FileAnnotationChange {
  date: string;
  user: AppUser;
  cause: 'user' | 'user_reannotation' | 'sys_reannotation';
  inclusionChanges: AnnotationInclusionChange[];
  exclusionChanges: AnnotationExclusionChange[];

  /**
   * Get a friendly label describing this cause.
   */
  get causeLabel(): string {
    switch (this.cause) {
      case 'user':
        return 'User';
      case 'user_reannotation':
        return 'Re-annotation';
      case 'sys_reannotation':
        return 'Automatic';
      default:
        return this.cause;
    }
  }

  get isReannotation() {
    // Use type checker to catch added types
    const cause: 'user' | 'user_reannotation' | 'sys_reannotation' = this.cause;
    return cause === 'user_reannotation' || cause === 'sys_reannotation';
  }

  update(data: FileAnnotationChangeData): FileAnnotationChange {
    this.date = data.date;
    this.user = data.user;
    this.cause = data.cause;
    this.inclusionChanges = data.inclusionChanges.map(
      itemData => new AnnotationInclusionChange().update(itemData));
    this.exclusionChanges = data.exclusionChanges.map(
      itemData => new AnnotationExclusionChange().update(itemData));
    return this;
  }
}

/**
 * A log of changes to annotations for a file.
 * @see FilesystemService#getAnnotationHistory
 */
export class FileAnnotationHistory extends ModelList<FileAnnotationChange> {
  constructor() {
    super();
    this.results.multipleSelection = false;
  }

  update(data: FileAnnotationHistoryResponse): FileAnnotationHistory {
    this.collectionSize = data.total;
    this.results.replace(data.results.map(
      itemData => new FileAnnotationChange().update(itemData)));
    return this;
  }
}
