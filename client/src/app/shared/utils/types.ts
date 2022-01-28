// TODO: Replace it with the null coalescing operator when we get it

export function nullCoalesce(...items) {
  for (const item of items) {
    if (item != null) {
      return item;
    }
  }
  return null;
}

export function emptyIfNull(s: any) {
  if (s == null) {
    return '';
  } else {
    return '' + s;
  }
}

export function nullIfEmpty(s: any) {
  if (s == null) {
    return null;
  } else if (!s.length) {
    return null;
  } else {
    return s;
  }
}

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export class ExtendedWeakMap<K extends object, V> extends WeakMap<K, V> {
  /**
   * Return key value if it exists in the map
   * otherwise use default value
   * @param key - used to identify value
   * @param value - default key value
   */
  getSet(key: K, value: V): V {
    if (this.has(key)) {
      return super.get(key);
    }
    super.set(key, value);
    return value;
  }
}

export class ExtendedMap<K, V> extends Map<K, V> {
  /**
   * Return key value if it exists in the map
   * otherwise use default value
   * @param key - used to identify value
   * @param value - default key value
   */
  getSet(key: K, value: V): V {
    if (this.has(key)) {
      return super.get(key);
    }
    super.set(key, value);
    return value;
  }
}


/** Return key value, if it does not exist call value accessor
 * Added for clarity on purpose
 * https://github.com/SBRG/kg-prototypes/pull/1387#discussion_r756414705
 */
export class LazyLoadedWeakMap<K extends object, V> extends WeakMap<K, V> {
  /**
   * Return key value if it exists in the map
   * otherwise use default value accessor
   * @param key - used to identify value
   * @param value - value or function to calculate it
   */
  getSet(key: K, value: (() => V) | V): V {
    if (this.has(key)) {
      return super.get(key);
    }
    const loadedValue = value instanceof Function ? value() : value;
    super.set(key, loadedValue);
    return loadedValue;
  }
}

/** Return key value, if it does not exist call value accessor
 * Added for clarity on purpose
 * https://github.com/SBRG/kg-prototypes/pull/1387#discussion_r756414705
 */
export class LazyLoadedMap<K, V> extends Map<K, V> {
  /**
   * Return key value if it exists in the map
   * otherwise use default value accessor
   * @param key - used to identify value
   * @param value - value or function to calculate it
   */
  getSet(key: K, value: (() => V) | V): V {
    if (this.has(key)) {
      return super.get(key);
    }
    const loadedValue = value instanceof Function ? value() : value;
    super.set(key, loadedValue);
    return loadedValue;
  }
}

export const frozenEmptyObject = Object.freeze({});
