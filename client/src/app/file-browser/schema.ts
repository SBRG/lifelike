import { PaginatedRequestOptions, ResultList, TreeNode } from 'app/shared/schemas/common';
import {
  AddedAnnotationExclusion,
  Annotation,
  AnnotationChangeExclusionMeta,
  Meta,
} from 'app/pdf-viewer/annotation-type';
import { AppUser, OrganismAutocomplete } from 'app/interfaces';

import { FilePrivileges, ProjectPrivileges } from './models/privileges';

// ========================================
// Projects
// ========================================

export interface ProjectData {
  hashId: string;
  name: string;
  description: string;
  creationDate: string;
  modifiedDate: string;
  root: FilesystemObjectData;
  privileges: ProjectPrivileges;
}

// Requests
// ----------------------------------------

/**
 * Search request.
 */
export interface ProjectSearchRequest extends PaginatedRequestOptions {
  name: string;
}

/**
 * Create request.
 */
export interface ProjectCreateRequest {
  name: string;
  description: string;
}

/**
 * Bulk update request.
 */
export interface BulkProjectUpdateRequest {
  name?: string;
  description?: string;
}

// ========================================
// Collaborators
// ========================================

export interface CollaboratorData {
  user: AppUser;
  roleName: string;
}

// Requests
// ----------------------------------------

export interface CollaboratorUpdateData {
  userHashId: string;
  roleName: string;
}

export interface MultiCollaboratorUpdateRequest {
  updateOrCreate?: CollaboratorUpdateData[];
  removeUserHashIds?: string[];
}

// ========================================
// Objects
// ========================================

export interface FilesystemObjectData {
  hashId: string;
  filename: string;
  user: unknown;
  description: string;
  mimeType: string;
  doi: string;
  public: boolean;
  annotationsDate: string;
  creationDate: string;
  modifiedDate: string;
  recyclingDate: string;
  parent: FilesystemObjectData;
  children: FilesystemObjectData[];
  project: ProjectData;
  privileges: FilePrivileges;
  recycled: boolean;
  effectivelyRecycled: boolean;
  highlight?: string[];
  fallbackOrganism: OrganismAutocomplete;
  annotationConfigs: AnnotationConfigurations;
  // TODO: Remove this if we ever give root files actual names instead of '/'. This mainly exists
  // as a helper for getting the real name of a root file.
  trueFilename: string;
  filePath: string;
}

interface ContentValue {
  contentValue: Blob;
  hashesOfLinked?: string[];
}

interface ContentUrl {
  contentUrl: string;
}

interface ContentObject {
  contentHashId: string;
}

type AllContent = ContentValue & ContentUrl & ContentObject;

// This type just means that you can only define either contentValue, contentUrl, OR
// contentHashId but not a combination of any of those.
// We use Record<T, never> to make all the keys of T to 'never', then we use
// Partial<T> to make the keys optional so the end result is { wantThis: any, dontWant?: never, ... }
export type ObjectContentSource = (ContentValue & Partial<Record<keyof Omit<AllContent, keyof ContentValue>, never>>)
  | (ContentUrl & Partial<Record<keyof Omit<AllContent, keyof ContentUrl>, never>>)
  | (ContentObject & Partial<Record<keyof Omit<AllContent, keyof ContentObject>, never>>);

// Requests
// ----------------------------------------

/**
 * Search request.
 */
export type ObjectSearchRequest = ({
  type: 'public';
  mimeTypes?: string[];
} & PaginatedRequestOptions) | {
  type: 'linked';
  linkedHashId: string;
  mimeTypes: ['vnd.lifelike.document/map'];
};

/**
 * Bulk update request.
 */
export interface BulkObjectUpdateRequest extends Partial<ContentValue> {
  filename?: string;
  parentHashId?: string;
  description?: string;
  uploadUrl?: string;
  public?: boolean;
  fallbackOrganism?: OrganismAutocomplete;
  annotationConfigs?: AnnotationConfigurations;
}

/**
 * Update request.
 */

// tslint:disable-next-line:no-empty-interface
export interface ObjectUpdateRequest extends BulkObjectUpdateRequest {
}

// We need to require the filename and parentHashId fields
type RequiredObjectCreateRequestFields = 'filename' | 'parentHashId';
type BaseObjectCreateRequest = Required<Pick<BulkObjectUpdateRequest, RequiredObjectCreateRequestFields>>
  & Omit<ObjectUpdateRequest, RequiredObjectCreateRequestFields>;

/**
 * Create request.
 */
export type ObjectCreateRequest = BaseObjectCreateRequest & Partial<ObjectContentSource> & {
  mimeType?: string;
};

/**
 * Export request.
 */
export interface ObjectExportRequest {
  format: string;
  exportLinked: boolean;
}

// Responses
// ----------------------------------------

export interface FileHierarchyResponse {
  results: TreeNode<FilesystemObjectData>[];
}

// ========================================
// Backups
// ========================================

// Requests
// ----------------------------------------

export interface ObjectBackupCreateRequest extends ContentValue {
  hashId: string;
}

// ========================================
// Versions
// ========================================

export interface ObjectVersionData {
  hashId: string;
  message?: string;
  user: unknown;
  creationDate: string;
}

// Responses
// ----------------------------------------

export interface ObjectVersionHistoryResponse extends ResultList<ObjectVersionData> {
  object: FilesystemObjectData;
}

// ========================================
// Locks
// ========================================

export interface ObjectLockData {
  user: AppUser;
  acquireDate: string;
}

// ========================================
// Annotations
// ========================================

export interface AnnotationGenerationResultData {
  attempted: boolean;
  success: boolean;
  error: string;
}

// Requests
// ----------------------------------------

export interface AnnotationMethods {
  [model: string]: {
    nlp: boolean;
    rulesBased: boolean;
  };
}

export interface AnnotationConfigurations {
  excludeReferences?: boolean;
  annotationMethods?: AnnotationMethods;
}

export interface PDFAnnotationGenerationRequest {
  organism?: OrganismAutocomplete;
  annotationConfigs?: AnnotationConfigurations;
}

/* tslint:disable-next-line */
export interface TextAnnotationGenerationRequest extends PDFAnnotationGenerationRequest {
  //
}

// ========================================
// Custom Annotations
// ========================================

// Requests
// ----------------------------------------

export interface CustomAnnotationCreateRequest {
  annotation: Annotation;
  annotateAll: boolean;
}

export interface CustomAnnotationDeleteRequest {
  removeAll: boolean;
}

// ========================================
// Annotation Exclusions
// ========================================

// Requests
// ----------------------------------------

export interface AnnotationExclusionCreateRequest {
  exclusion: AddedAnnotationExclusion;
}

export interface AnnotationExclusionDeleteRequest {
  type: string;
  text: string;
}

// ========================================
// Annotation history
// ========================================

export interface AnnotationChangeData {
  action: 'added' | 'removed';
}

export interface AnnotationInclusionChangeData extends AnnotationChangeData {
  meta: Meta;
}

export interface AnnotationExclusionChangeData extends AnnotationChangeData {
  meta: AnnotationChangeExclusionMeta;
}

export interface FileAnnotationChangeData {
  date: string;
  user: AppUser;
  cause: 'user' | 'user_reannotation' | 'sys_reannotation';
  inclusionChanges: AnnotationInclusionChangeData[];
  exclusionChanges: AnnotationExclusionChangeData[];
}

export interface FileAnnotationHistoryResponse extends ResultList<FileAnnotationChangeData> {
}
