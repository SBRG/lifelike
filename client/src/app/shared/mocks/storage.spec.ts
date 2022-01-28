export class MemoryStorage implements Storage {
  storage: { [key: string]: any };

  constructor(init: { [key: string]: any } = {}) {
    this.storage = {};
    Object.entries(init).forEach(([key, value]) => this.setItem(key, value));
  }

  get length(): number {
    return Object.keys(this.storage).length;
  }

  key(index: number): string | null {
    return Object.keys(this.storage)[index];
  }

  getItem(key: string): string {
    return key in this.storage ? this.storage[key] : null;
  }

  setItem(key: string, value: string) {
    this.storage[key] = `${value}`;
  }

  removeItem(key: string) {
    delete this.storage[key];
  }

  clear() {
    this.storage = {};
  }
}

/**
 * Provide mock for Storage object (localStorage, sessionStorage)
 * Mocks calls to all the functions except of length property
 * @param storage storage reference which should be mocked
 * @param initialValue value to initialise mocked storage
 */
export function mockStorage(storage: Storage, initialValue: { [key: string]: string } = {}) {
  storage.clear();
  const storageMock = new MemoryStorage(initialValue);
  const spyLocalStorage = spyOnAllFunctions(storage, false);
  Object.keys(spyLocalStorage).forEach(key => {
    spyLocalStorage[key].and.callFake(storageMock[key].bind(storageMock));
  });
  return storageMock;
}
