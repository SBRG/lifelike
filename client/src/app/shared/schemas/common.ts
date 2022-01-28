export type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>;
};

export interface TreeNode<T> {
  data: T;
  level: number;
  children: TreeNode<T>[];
}

export interface FlatNode<F> {
  data: F;
  level: number;
  expandable: boolean;
}

export interface PaginatedRequestOptions {
  sort?: string;
  page?: number;
  limit?: number;
}

export interface SearchableRequestOptions {
  q?: string;
}

export type StandardRequestOptions = PaginatedRequestOptions & SearchableRequestOptions;

export interface RankedItem<T> {
  item: T;
  rank: number;
}

export interface ResultQuery {
  phrases: string[];
}

export interface SingleResult<T> {
  result: T;
}

export interface ResultMapping<T> {
  mapping: { [key: string]: T };
  missing: string[];
}

export interface ResultList<T> {
  total: number;
  results: T[];
  query?: ResultQuery;
}

export interface ErrorResponse {
  title: string;
  message: string;
  additionalMsgs?: string[];
  stacktrace?: string;
  code?: number;
  version?: string;
  transactionId?: string;
  fields?: { [key: string]: string[] };
}

export interface ErrorLogMeta {
  label?: string;
  expected?: boolean;
  url?: string;
}

export interface ErrorLog extends ErrorLogMeta {
  title: string;
  message: string;
  additionalMsgs?: string;
  stacktrace?: string;
  transactionId?: string;
}
