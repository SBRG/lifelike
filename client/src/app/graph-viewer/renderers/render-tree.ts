export interface RenderTree<T = any> {
  delete(key: T): void;

  clear(): void;

  enqueueRenderFromKey(key: T): void;
}
