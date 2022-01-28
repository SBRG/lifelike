export interface Location {
  pageNumber: number;
  rect: Rect;
  jumpText?: string;
}

export interface BiocAnnotationLocation {
  offset: string;
  start?: string;
  len?: string;
}

export interface Links {
  ncbi?: string;
  uniprot?: string;
  wikipedia?: string;
  google?: string;
}

export interface Meta {
  type: string;
  id?: string;
  idType?: string;
  idHyperlinks?: string[];
  isCustom?: boolean;
  allText?: string;
  links?: Links;
  isExcluded?: boolean;
  exclusionReason?: string;
  exclusionComment?: string;
  includeGlobally?: boolean;
  isCaseInsensitive?: boolean;
}

export type Rect = number[];

export interface Annotation {
  pageNumber: number;
  keywords: string[];
  rects: Rect[];
  meta: Meta;
  uuid?: string;
  textInDocument?: string;
}

export interface RemovedAnnotationExclusion {
  type: string;
  text: string;
}

export interface AddedAnnotationExclusion {
  type: string;
  text: string;
  id: string;
  idHyperlinks: string[];
  reason: string;
  comment: string;
  rects: Rect[];
  pageNumber: number;
  excludeGlobally: boolean;
  isCaseInsensitive: boolean;
}

export type AnnotationChangeExclusionMeta = Pick<AddedAnnotationExclusion,
  'id' | 'idHyperlinks' | 'text' | 'type' | 'reason' | 'comment' |
  'excludeGlobally' | 'isCaseInsensitive'>;
