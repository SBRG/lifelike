import { Observable, Subject } from 'rxjs';
import { debounceTime, map } from 'rxjs/operators';

import { PlacedObject, PlacedObjectRenderer } from '../../styles/styles';
import { RenderTree } from '../render-tree';

export class PlacedObjectRenderTree<T = any> implements PlacedObjectRenderer, RenderTree {

  private readonly children: Map<T, PlacedObject> = new Map();
  private renderQueue: Map<PlacedObject, boolean> = new Map();
  private readonly renderStart$ = new Subject<any>();
  readonly renderRequest$: Observable<[PlacedObject, boolean][]> = this.renderStart$.pipe(
    debounceTime(100),
    map(() => {
      const result: [PlacedObject, boolean][] = Array.from(this.renderQueue.entries());
      this.renderQueue.clear();
      return result;
    }),
  );

  get(key: T): PlacedObject | undefined {
    return this.children.get(key);
  }

  set(key: T, value: PlacedObject): void {
    this.children.set(key, value);
    try {
      value.bind(this);
      value.objectDidBind();
    } catch (e) {
      console.error('failed to bind', value, e);
    }
    this.renderQueue.set(value, true);
    this.renderStart$.next();
  }

  delete(key: T): void {
    const value: PlacedObject = this.children.get(key);
    if (value != null) {
      this.doUnbind(value);
      this.renderQueue.set(value, false);
      this.children.delete(key);
      this.renderStart$.next();
    }
  }

  clear() {
    for (const value of this.children.values()) {
      this.doUnbind(value);
      this.renderQueue.set(value, false);
    }
    this.children.clear();
    this.renderStart$.next();
  }

  enqueueRenderFromKey(key: T) {
    const value = this.children.get(key);
    if (value != null) {
      this.enqueueRender(value);
    }
  }

  enqueueRender(value: PlacedObject) {
    this.renderQueue.set(value, true);
    this.renderStart$.next();
  }

  private doUnbind(value: PlacedObject) {
    try {
      value.objectWillUnbind();
      value.bind(null);
    } catch (e) {
      console.error('failed to unbind', value, e);
    }
  }

}
