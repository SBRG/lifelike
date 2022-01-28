import { Injectable } from '@angular/core';

import {
  DataTransferData,
  DataTransferDataProvider,
  DataTransferToken,
} from 'app/shared/services/data-transfer-data.service';

import { FilesystemObject } from '../models/filesystem-object';
import { FilePrivileges } from '../models/privileges';

export const FILESYSTEM_OBJECT_TRANSFER_TOKEN = new DataTransferToken<FilesystemObject[]>('filesystemObjectTransfer');
export const FILESYSTEM_OBJECT_TRANSFER_TYPE = 'vnd.lifelike.transfer/filesystem-object';

export class FilesystemObjectTransferData {
  hashId: string;
  privileges: FilePrivileges;
}

@Injectable()
export class FilesystemObjectDataProvider implements DataTransferDataProvider {

  extract(dataTransfer: DataTransfer): DataTransferData<any>[] {
    const results: DataTransferData<FilesystemObjectTransferData[]>[] = [];

    const data = dataTransfer.getData(FILESYSTEM_OBJECT_TRANSFER_TYPE);
    if (data !== '') {
      const transferData: FilesystemObjectTransferData = JSON.parse(data);
      results.push({
        token: FILESYSTEM_OBJECT_TRANSFER_TOKEN,
        data: [transferData],
        confidence: 0,
      });
    }

    return results;
  }

}
