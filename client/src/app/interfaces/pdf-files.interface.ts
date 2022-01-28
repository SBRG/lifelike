import { OrganismAutocomplete } from './neo4j.interface';

export interface PdfFiles {
  files: PdfFile[];
}

export interface PdfFile {
  // minimum field needed for the interface
  file_id: string;
  /**
   * Containing directory ID. Most endpoints do not return this.
   */
  dir_id?: any;
  /**
   * Most endpoints do not return this.
   */
  project_name?: string;
  // optional
  doi?: string;
  upload_url?: string;
  filename?: string;
  creation_date?: string;
  modified_date?: string;
  description?: string;
  username?: string;
  annotations_date?: string;
  annotations_date_tooltip?: string;
}

export interface PdfFileUpload {
  file_id: string;
  filename: string;
  status: string;
}

export enum UploadType {
  Files = 'files',
  Url = 'url',
}

export interface UploadPayload {
  type: UploadType;
  filename: string;
  description?: string;
  // if type === Files
  files?: File[];
  // if type === Url
  url?: string;
  annotationMethod: string;
  organism?: OrganismAutocomplete;
}
