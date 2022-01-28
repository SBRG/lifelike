import { Injectable } from '@angular/core';

import { chunk } from 'lodash-es';

import {
  DataTransferData,
  DataTransferDataProvider,
  DataTransferToken,
} from '../../services/data-transfer-data.service';
import { nullCoalesce } from '../../utils/types';

export const LABEL_TOKEN = new DataTransferToken<string>('label');
export const URI_TOKEN = new DataTransferToken<URIData[]>('uri-list');

export class URIData {
  title: string | undefined;
  uri: string;
}

@Injectable()
export class GenericDataProvider implements DataTransferDataProvider {

  private static readonly acceptedUriPattern = new RegExp('^[A-Za-z0-9-]{1,40}:');

  static setURIs(dataTransfer: DataTransfer, data: URIData[], options: {
    action?: 'replace' | 'append'
  } = {}) {
    if (data.length) {
      if (options.action === 'replace' || !dataTransfer.getData('text/uri-list')) {
        dataTransfer.setData('text/uri-list', this.marshalUriList(data));
      }

      // We can't always read the data transfer data
      if (!dataTransfer.types.includes('text/x-moz-url') || dataTransfer.getData('text/x-moz-url')) {
        const existing: URIData[] = options.action === 'replace' ? []
          : GenericDataProvider.unmarshalMozUrlList(
            dataTransfer.getData('text/x-moz-url'),
            'Link',
          );
        existing.push(...data);
        dataTransfer.setData('text/x-moz-url', GenericDataProvider.marshalMozUrlList(existing));
      }
    }
  }

  private static marshalMozUrlList(data: URIData[]): string {
    return data.map(item => `${item.uri.replace(/[\r\n]/g, '')}\r\n${item.title.replace(/[\r\n]/g, '')}`).join('\r\n');
  }

  private static marshalUriList(data: URIData[]): string {
    return data.map(item => item.uri).join('\r\n');
  }

  private static unmarshalMozUrlList(data: string, fallbackTitle: string): URIData[] {
    if (data === '') {
      return [];
    }

    const uris: URIData[] = [];

    for (const [uri, title] of chunk(data.split(/\r?\n/g), 2)) {
      if (uri.match(GenericDataProvider.acceptedUriPattern)) {
        uris.push({
          title: nullCoalesce(title, fallbackTitle).trim().replace(/ {2,}/g, ' '),
          uri,
        });
      }
    }

    return uris;
  }

  extract(dataTransfer: DataTransfer): DataTransferData<any>[] {
    const results: DataTransferData<any>[] = [];
    let text: string | undefined;

    if (dataTransfer.types.includes('text/plain')) {
      text = dataTransfer.getData('text/plain');
    } else if (dataTransfer.types.includes('text/html')) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(dataTransfer.getData('text/html'), 'text/html');
      text = (doc.textContent || '').trim();
    }

    text = text.trim().replace(/ {2,}/g, ' ');

    if (dataTransfer.types.includes('text/x-moz-url')) {
      const data = dataTransfer.getData('text/x-moz-url');

      const uris = GenericDataProvider.unmarshalMozUrlList(data, text);

      results.push({
        token: URI_TOKEN,
        data: uris,
        confidence: 0,
      });
    } else if (dataTransfer.types.includes('text/uri-list')) {
      results.push({
        token: URI_TOKEN,
        data: dataTransfer.getData('text/uri-list').split(/\r?\n/g)
          .filter(item => item.trim().length && !item.startsWith('#') && item.match(GenericDataProvider.acceptedUriPattern))
          .map(uri => ({
            title: text,
            uri,
          })),
        confidence: 0,
      });
    }

    results.push({
      token: LABEL_TOKEN,
      data: text,
      confidence: 0,
    });

    return results;
  }
}
