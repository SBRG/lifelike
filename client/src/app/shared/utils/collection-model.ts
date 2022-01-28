import { Subject } from 'rxjs';

export class CollectionModel<T> {
  multipleSelection = false;
  _filter: (item: T) => boolean;
  _sort: (a: T, b: T) => number;

  private _items = new Set<T>();
  private viewOutdated = true;
  private _filteredItems = [];
  private _selection = new Set<T>();
  readonly itemChanges$ = new Subject<CollectionChange<T>>();
  readonly selectionChanges$ = new Subject<CollectionChange<T>>();

  constructor(items: T[] = [], options: CollectionModalOptions<T> = {}) {
    Object.assign(this, options);
    this.replace(items);
  }

  get items(): readonly T[] {
    return Object.freeze([...this._items]);
  }

  get view(): T[] {
    if (this.viewOutdated) {
      let filteredItems = [...this._items];

      if (this._filter != null) {
        filteredItems = filteredItems.filter(this._filter);
      }

      if (this._sort != null) {
        filteredItems.sort(this._sort);
      }

      this._filteredItems = filteredItems;
      this.viewOutdated = false;
    }

    return this._filteredItems;
  }

  get selection(): readonly T[] {
    return Object.freeze([...this._selection]);
  }

  get filter(): ((item: T) => boolean) | undefined {
    return this._filter;
  }

  set filter(filter: ((item: T) => boolean) | undefined) {
    this.viewOutdated = true;
    this._filter = filter;
  }

  get sort(): ((a: T, b: T) => number) | undefined {
    return this._sort;
  }

  set sort(sort: ((a: T, b: T) => number) | undefined) {
    this.viewOutdated = true;
    this._sort = sort;
  }

  push(item: T): void {
    if (!this._items.has(item)) {
      this._items.add(item);

      this.viewOutdated = true;

      this.itemChanges$.next({
        source: this,
        added: new Set<T>([item]),
        removed: new Set<T>(),
      });
    }
  }

  delete(item: T) {
    if (this._items.has(item)) {
      this._items.delete(item);

      if (this._selection.delete(item)) {
        this.selectionChanges$.next({
          source: this,
          added: new Set<T>(),
          removed: new Set<T>([item]),
        });
      }

      this.viewOutdated = true;

      this.itemChanges$.next({
        source: this,
        added: new Set<T>(),
        removed: new Set<T>([item]),
      });
    }
  }

  replace(items: T[]): void {
    const newSet = new Set<T>(items);
    const oldSet = this._items;

    const itemsAdded = new Set<T>();
    const itemsRemoved = new Set<T>();
    const selectionRemoved = new Set<T>();

    for (const newItem of newSet) {
      if (!oldSet.has(newItem)) {
        itemsAdded.add(newItem);
      }
    }

    for (const oldItem of oldSet) {
      if (!newSet.has(oldItem)) {
        itemsRemoved.add(oldItem);
        if (this._selection.delete(oldItem)) {
          selectionRemoved.add(oldItem);
        }
      }
    }

    if (itemsAdded.size || itemsRemoved.size) {
      this._items = newSet;
      this.viewOutdated = true;

      this.itemChanges$.next({
        source: this,
        added: itemsAdded,
        removed: itemsRemoved,
      });

      if (selectionRemoved.size) {
        this.selectionChanges$.next({
          source: this,
          added: new Set<T>(),
          removed: selectionRemoved,
        });
      }
    }
  }

  select(...items: T[]): void {
    const added = new Set<T>();
    const removed = new Set<T>();

    for (const item of items) {
      if (!this._selection.has(item)) {
        if (!this.multipleSelection) {
          for (const existingItem of this._selection) {
            removed.add(existingItem);
            added.delete(existingItem);
          }
          this._selection.clear();
        }
        this._selection.add(item);
        added.add(item);
      }
    }

    if (added.size || removed.size) {
      this.selectionChanges$.next({
        source: this,
        added,
        removed,
      });
    }
  }

  deselect(...items: T[]): void {
    const removed = new Set<T>();

    for (const item of items) {
      if (this._selection.delete(item)) {
        removed.add(item);
      }
    }

    if (removed.size) {
      this.selectionChanges$.next({
        source: this,
        added: new Set<T>(),
        removed,
      });
    }
  }

  selectOnly(item: T): void {
    const deselect = new Set<T>();
    for (const other of this._selection) {
      if (item !== other) {
        deselect.add(other);
      }
    }
    if (deselect.size) {
      this.deselect(...deselect.values());
    }
    if (!this._selection.has(item)) {
      this.select(item);
    }
  }

  selectAll(): void {
    this.select(...this._items);
  }

  deselectAll(): void {
    this.deselect(...this._items);
  }

  clear(): void {
    return this.deselectAll();
  }

  toggle(item: T): void {
    if (this.isSelected(item)) {
      this.deselect(item);
    } else {
      this.select(item);
    }
  }

  toggleAll(): void {
    if (this.isAllSelected()) {
      this.deselectAll();
    } else {
      this.selectAll();
    }
  }

  isAllSelected(): boolean {
    return this._selection.size === this._items.size;
  }

  isSelected(item: T) {
    return this._selection.has(item);
  }

  get lastSelection(): T | undefined {
    const selection = this.selection;
    if (selection.length) {
      return selection[selection.length - 1];
    } else {
      return null;
    }
  }

  get length(): number {
    return this._items.size;
  }

  get viewLength(): number {
    return this.view.length;
  }
}

export interface CollectionChange<T> {
  source: CollectionModel<T>;
  added: Set<T>;
  removed: Set<T>;
}

export interface CollectionModalOptions<T> {
  multipleSelection?: boolean;
  filter?: (item: T) => boolean;
  sort?: (a: T, b: T) => number;
}
