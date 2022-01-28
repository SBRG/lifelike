import { Injectable, InjectionToken, Injector } from '@angular/core';

export const DATA_TRANSFER_DATA_PROVIDER = new InjectionToken<DataTransferDataProvider[]>('dragDataProvider');

export class DataTransferToken<T> {
  constructor(readonly description: string) {
  }
}

@Injectable()
export class DataTransferDataService {
  constructor(protected readonly injector: Injector) {
  }

  extract(dataTransfer: DataTransfer): DataTransferData<any>[] {
    const data: DataTransferData<any>[] = [];
    const providers = this.injector.get(DATA_TRANSFER_DATA_PROVIDER);
    for (const provider of providers) {
      data.push(...provider.extract(dataTransfer));
    }
    return data;
  }
}

export interface DataTransferDataProvider {
  extract(dataTransfer: DataTransfer): DataTransferData<any>[];
}

export interface DataTransferData<T> {
  token: DataTransferToken<T>;

  data: T;

  /**
   * A higher number is a higher confidence.
   */
  confidence: number;
}
