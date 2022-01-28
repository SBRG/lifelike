import { RecursivePartial } from 'app/shared/utils/types';
import { AppUser } from 'app/interfaces';

import { ObjectLockData } from '../schema';

export class ObjectLock {
  user: AppUser;
  acquireDate: string;

  update(data: RecursivePartial<ObjectLockData>): ObjectLock {
    if (data == null) {
      return this;
    }
    for (const key of ['user', 'acquireDate']) {
      if (key in data) {
        this[key] = data[key];
      }
    }
    return this;
  }
}
