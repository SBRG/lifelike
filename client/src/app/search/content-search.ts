import { StandardRequestOptions } from 'app/shared/schemas/common';

import { SearchType } from './shared';

/**
 * Represents unserialized content search specific request options.
 */
export interface ContentSearchOptions extends StandardRequestOptions {
  /** A list of  objects representing file types. */
  types?: SearchType[];
  /** A list of file hash IDs. */
  folders?: string[];
}
