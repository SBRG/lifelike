import { PaginatedRequestOptions } from '../schemas/common';

export function getChoicesFromQuery<T>(params: { [key: string]: string }, key: string, choicesMap: Map<string, T>): T[] {
  if (params.hasOwnProperty(key)) {
    if (params[key] === '') {
      return [];
    } else {
      const choices: T[] = [];
      for (const id of params[key].split(';')) {
        const choice = choicesMap.get(id);
        if (choice != null) {
          choices.push(choice);
        }
      }
      return choices;
    }
  } else {
    return null;
  }
}

export function deserializePaginatedParams(params: { [key: string]: string }, defaultLimit): Required<PaginatedRequestOptions> {
  return {
    page: params.hasOwnProperty('page') ? parseInt(params.page, 10) : 1,
    limit: params.hasOwnProperty('limit') ? parseInt(params.limit, 10) : defaultLimit,
    sort: params.hasOwnProperty('sort') ? params.sort : '',
  };
}

export function serializePaginatedParams<O extends PaginatedRequestOptions>(
  params: O, restartPagination: boolean): Record<keyof PaginatedRequestOptions, string> {
  return params != null ? {
    page: restartPagination ? '1' : (params.page != null ? params.page + '' : ''),
    limit: params.limit != null ? params.limit + '' : '',
    sort: params.sort != null ? params.sort : '',
  } : {
    page: '1',
    limit: '50',
    sort: '',
  };
}
