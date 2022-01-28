import { VIZ_SEARCH_LIMIT } from 'app/shared/constants';

import { GraphSearchParameters } from '../graph-search';

export function getQueryParams(params: GraphSearchParameters) {
  return {
    q: params.query,
    page: params.page,
    domains: params.domains ? params.domains.join(';') : null,
    entities: params.entities ? params.entities.join(';') : null,
    organism: params.organism,
  };
}

export function createSearchParamsFromQuery(params): GraphSearchParameters {
  return {
    query: params.q,
    domains: params.domains === '' ? [] : params.domains.split(';'),
    entities: params.entities === '' ? [] : params.entities.split(';'),
    organism: params.organism,
    page: params.page != null && params.page.length ? parseInt(params.page, 10) : 1,
    limit: VIZ_SEARCH_LIMIT,
  };
}
