export interface InclusionMeta {
    allText: string;
    id: string;
    idHyperlinks: string[];
    includeGlobally: boolean;
    isCustom: boolean;
    links: object;
    type: string;
}

export interface GlobalAnnotationListItem {
    globalId: number;
    synonymId?: number;
    fileUuid: string;
    creator: string;
    fileDeleted: boolean;
    // contentReference: string;
    type: string;
    creationDate: string;
    text: string;
    caseInsensitive: boolean;
    entityType: string;
    entityId: string;
    reason: string;
    comment: string;
}

export type AnnotationMethods = 'NLP' | 'Rules Based';
export const NLPANNOTATIONMODELS = new Set(['Chemical', 'Disease', 'Gene']);
