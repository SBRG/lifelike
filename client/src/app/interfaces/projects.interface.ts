import { Directory, Project } from 'app/file-browser/services/project-space.service';
import { KnowledgeMap } from 'app/drawing-tool/services/interfaces';

import { PdfFile } from './pdf-files.interface';
import { User } from './auth.interface';

export interface DirectoryContent {
  dir: Directory;
  path: Directory[];
  objects: DirectoryObject[];
}

export interface DirectoryObject {
  type: 'dir' | 'file' | 'map';
  id?: any;
  name: string;
  description?: string;
  annotationDate?: string;
  creationDate?: string;
  modificationDate?: string;
  doi?: string;
  highlight?: string[];
  highlightAnnotated?: boolean[];
  creator?: User;
  project: Pick<Project, 'projectName'>;
  data?: Directory | KnowledgeMap | PdfFile;
}
