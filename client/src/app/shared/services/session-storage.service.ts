import { Injectable } from '@angular/core';

import { uuidv4 } from '../utils';

@Injectable({
  providedIn: 'root'
})
export class SessionStorageService implements Storage {
  private readonly storage;

  constructor() {
    this.storage = window.sessionStorage;
  }

  get length() {
    return this.storage.length;
  }

  key(n) {
    return this.storage.key(n);
  }

  getItem(key) {
    return this.storage.getItem(key);
  }

  setItem(value, key?) {
    key = typeof key === 'undefined' ? uuidv4() : key;
    this.storage.setItem(key, value);
    return key;
  }

  removeItem(key) {
    this.storage.removeItem(key);
  }

  clear() {
    this.storage.clear();
  }

  get(key) {
    const content = this.getItem(key);
    return JSON.parse(content);
  }

  set(value, key?) {
    const content = JSON.stringify(value);
    return this.setItem(content, key);
  }
}
