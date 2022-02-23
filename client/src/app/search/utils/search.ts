import { omitBy, isNil } from 'lodash-es';

import { VIZ_SEARCH_LIMIT } from 'app/shared/constants';
import { PaginatedRequestOptions, SearchableRequestOptions } from 'app/shared/schemas/common';
import { getChoicesFromQuery, deserializePaginatedParams, serializePaginatedParams } from 'app/shared/utils/params';

import { GraphSearchParameters } from '../graph-search';
import { SearchType } from '../shared';
import { ContentSearchOptions } from '../content-search';

export interface GraphQueryParameters extends Omit<GraphSearchParameters, 'query' | 'domains' | 'entities' | 'page' | 'limit'>,
  SearchableRequestOptions {
  domains?: string;
  entities?: string;
  page: string;
}

export const getGraphQueryParams: (params: Partial<GraphSearchParameters>) => GraphQueryParameters =
  ({query, domains, entities, page, ...rest}) => ({
    q: query,
    domains: domains?.join(';'),
    entities: entities?.join(';'),
    page: '' + page,
    ...rest
  });

export const createGraphSearchParamsFromQuery: (params: GraphQueryParameters) => GraphSearchParameters =
  ({q, domains, entities, page, ...rest}) => ({
    query: q,
    domains: domains?.split(';') ?? [],
    entities: entities?.split(';') ?? [],
    page: parseInt(page, 10) || 1,
    limit: VIZ_SEARCH_LIMIT,
    ...rest
  });

export type ContentSearchQueryParameters = {
  [paginatedRequestParam in keyof PaginatedRequestOptions]?: string
} & {
  [contentSearchParam in keyof ContentSearchOptions]?: string
} & SearchableRequestOptions & {
  wildcards?: string,
  phrase?: string,
};

export type ContentSearchParameters = PaginatedRequestOptions & ContentSearchOptions & SearchableRequestOptions & {
  wildcards?: string,
  phrase?: string
};


export const getContentSearchQueryAdvancedParams = ({types = [], folders = []}) =>
  omitBy({
    types: types.map(value => value.shorthand ?? value).join(';'),
    folders: folders.join(';')
  }, isNil);

export const getContentSearchQueryParams = ({q = '', ...params}, restartPagination = false) => ({
  ...serializePaginatedParams(params, restartPagination),
  ...getContentSearchQueryAdvancedParams(params),
  q
});


const createContentSearchAdvancedParamsFromQuery =
  ({types, folders, phrase, wildcards}: ContentSearchQueryParameters, searchTypesMap: Map<string, SearchType>) => omitBy({
    types: types ? getChoicesFromQuery({types}, 'types', searchTypesMap) : [],
    folders: folders?.split(';') ?? [],
    phrase,
    wildcards
  }, isNil);

export const createContentSearchParamsFromQuery:
  (
    queryParams: ContentSearchQueryParameters,
    {defaultLimit, searchTypesMap}
  ) => ContentSearchParameters =
  (params, {defaultLimit, searchTypesMap}) =>
    ({
      ...deserializePaginatedParams(params, defaultLimit),
      ...createContentSearchAdvancedParamsFromQuery(params, searchTypesMap),
      q: params.hasOwnProperty('q') ? params.q : '',
    });
