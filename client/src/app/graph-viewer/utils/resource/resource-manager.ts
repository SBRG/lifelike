import { BehaviorSubject, Observable } from 'rxjs';

export interface ResourceOwner {
  resourceOwnerClass: string;
}

export interface ResourceManager<K, V> {
  acquire(owner: ResourceOwner, id: K): Observable<V>;
  release(owner: ResourceOwner);
}

export interface ResourceProvider<K, V> {
  get(id: K): Observable<V>;
}

export class DelegateResourceManager<K, V> implements ResourceManager<K, V> {
  private readonly resources: Map<K, Resource<V>> = new Map();

  constructor(protected readonly provider: ResourceProvider<K, V>) {
  }

  acquire(owner: ResourceOwner, id: K): Observable<V> {
    let resource = this.resources.get(id);
    if (resource == null) {
      resource = new Resource<V>();
      this.resources.set(id, resource);
      this.provider.get(id).subscribe(resource.subject);
    }
    resource.owners.add(owner);
    return resource.subject;
  }

  release(owner: ResourceOwner) {
    const removeIds = [];
    for (const [id, resource] of this.resources.entries()) {
      resource.owners.delete(owner);
      if (!resource.owners.size) {
        removeIds.push(id);
      }
    }
    // TODO: Garbage collect!!
    // TODO: Garbage collect!!
    // TODO: Garbage collect!!
    // TODO: Garbage collect!!
    // TODO: Garbage collect!!
    // TODO: Garbage collect!!
    // TODO: Garbage collect!!
    // TODO: Garbage collect!!
    // TODO: Garbage collect!!
    /*for (const id of removeIds) {
      this.resources.delete(id);
    }*/
  }
}

class Resource<V> {
  readonly owners = new Set<ResourceOwner>();
  readonly subject = new BehaviorSubject<V | undefined>(null);
}
