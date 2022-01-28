import { isNil } from 'lodash-es';
import moment from 'moment';

import {
  KnowledgeMap,
  Source,
  UniversalEntityData,
  UniversalGraph,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { AppUser, OrganismAutocomplete, User } from 'app/interfaces';
import { PdfFile } from 'app/interfaces/pdf-files.interface';
import { DirectoryObject } from 'app/interfaces/projects.interface';
import { Meta } from 'app/pdf-viewer/annotation-type';
import { annotationTypesMap } from 'app/shared/annotation-styles';
import {MimeTypes, Unicodes, FAClass, CustomIconColors} from 'app/shared/constants';
import { CollectionModel } from 'app/shared/utils/collection-model';
import { DragImage } from 'app/shared/utils/drag';
import { nullCoalesce, RecursivePartial } from 'app/shared/utils/types';
import {getSupportedFileCodes} from 'app/shared/utils';

import { FilePrivileges, ProjectPrivileges } from './privileges';
import {
  FILESYSTEM_OBJECT_TRANSFER_TYPE,
  FilesystemObjectTransferData,
} from '../providers/filesystem-object-data.provider';
import { AnnotationConfigurations, FilesystemObjectData, ProjectData } from '../schema';
import { Directory, Project } from '../services/project-space.service';
import {createDragImage} from '../utils/drag';

// TODO: Rename this class after #unifiedfileschema
export class ProjectImpl implements Project {
  /**
   * Legacy ID field that needs to go away.
   */
  id?: number;
  hashId: string;
  name: string;
  description: string;
  creationDate: string;
  modifiedDate: string;
  root?: FilesystemObject;
  privileges: ProjectPrivileges;

  get projectName() {
    return this.name;
  }

  get directory(): Directory {
    return this.root ? this.root.directory : null;
  }

  update(data: RecursivePartial<ProjectData>): ProjectImpl {
    if (data == null) {
      return this;
    }
    for (const key of ['hashId', 'name', 'description', 'creationDate', 'modifiedDate',
      'privileges']) {
      if (data.hasOwnProperty(key)) {
        this[key] = data[key];
      }
    }
    if (data.hasOwnProperty('root')) {
      this.root = data.root != null ? new FilesystemObject().update(data.root) : null;
    }
    return this;
  }

  getCommands(): any[] {
    return ['/projects', this.name];
  }

  getURL(): string {
    return this.getCommands().map(item => {
      return encodeURIComponent(item.replace(/^\//, ''));
    }).join('/');
  }

  get colorHue(): number {
    let hash = 3242;
    for (let i = 0; i < this.hashId.length; i++) {
      // tslint:disable-next-line:no-bitwise
      hash = ((hash << 3) + hash) + this.hashId.codePointAt(i);
    }
    return hash % 100 / 100;
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    createProjectDragImage(this).addDataTransferData(dataTransfer);

    const node: Partial<Omit<UniversalGraphNode, 'data'>> & { data: Partial<UniversalEntityData> } = {
      display_name: this.name,
      label: 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.id + '',
        }],
        sources: [{
          domain: 'File Source',
          url: this.getCommands().join('/'),
        }],
      },
    };

    dataTransfer.effectAllowed = 'all';
    dataTransfer.setData('text/plain', this.name);
    dataTransfer.setData('application/lifelike-node', JSON.stringify(node));
  }
}

/**
 * This object represents both directories and every type of file in Lifelike. Due
 * to a lot of legacy code, we implement several legacy interfaces to reduce the
 * amount of code for the refactor.
 */
export class FilesystemObject implements DirectoryObject, Directory, PdfFile, KnowledgeMap {
  hashId: string;
  filename: string;
  user: AppUser;
  description: string;
  mimeType: string;
  doi: string;
  public: boolean;
  uploadUrl: string;
  annotationsDate: string;
  creationDate: string;
  modifiedDate: string;
  recyclingDate: string;
  project: ProjectImpl;
  parent: FilesystemObject;
  readonly children = new CollectionModel<FilesystemObject>([], {
    multipleSelection: true,
    sort: this.defaultSort,
  });
  privileges: FilePrivileges;
  fallbackOrganism?: OrganismAutocomplete;
  recycled: boolean;
  effectivelyRecycled: boolean;
  annotationConfigs?: AnnotationConfigurations;
  // TODO: Remove this if we ever give root files actual names instead of '/'. This mainly exists
  // as a helper for getting the real name of a root file.
  trueFilename: string;
  filePath: string;

  highlight?: string[];
  highlightAnnotated?: boolean[];
  // tslint:disable-next-line:variable-name
  annotations_date_tooltip?: string;
  annotationsTooltipContent: string;

  get isDirectory() {
    return this.mimeType === MimeTypes.Directory;
  }

  get isFile() {
    return !this.isDirectory;
  }

  get isOpenable() {
    switch (this.mimeType) {
      case MimeTypes.Directory:
      case MimeTypes.Map:
      case MimeTypes.EnrichmentTable:
      case MimeTypes.Graph:
      case MimeTypes.BioC:
      case 'application/pdf':
        return true;
      default:
        return false;
    }
  }

  get isEditable() {
    // TODO: Move this method to ObjectTypeProvider
    return !(this.isDirectory && !this.parent);
  }

  get isAnnotatable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.mimeType === 'application/pdf' ||
      this.mimeType === 'vnd.lifelike.document/enrichment-table';
  }

  get promptOrganism() {
    return this.mimeType !== MimeTypes.EnrichmentTable;
  }

  get isMovable() {
    // TODO: Move this method to ObjectTypeProvider
    return !(this.isDirectory && !this.parent);
  }

  get isCloneable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.isFile;
  }

  get isDeletable() {
    // TODO: Move this method to ObjectTypeProvider
    return true;
  }

  get isVersioned() {
    // TODO: Move this method to ObjectTypeProvider
    return this.mimeType === MimeTypes.Map;
  }

  get isNavigable() {
    // TODO: Move this method to ObjectTypeProvider
    return this.isDirectory || this.mimeType === MimeTypes.Pdf || this.mimeType === MimeTypes.Map
      || this.mimeType === MimeTypes.EnrichmentTable || this.mimeType === MimeTypes.BioC;
  }

  get hasWordCloud() {
    // TODO: Move this method to ObjectTypeProvider
    return this.isDirectory || this.mimeType === MimeTypes.Pdf || this.mimeType === MimeTypes.EnrichmentTable;
  }

  /**
   * @deprecated
   */
  get locator(): PathLocator {
    if (this.type === 'dir') {
      return {
        projectName: this.project.name,
        directoryId: this.hashId,
      };
    } else if (this.parent != null) {
      return this.parent.locator;
    } else {
      throw new Error('no locator available');
    }
  }

  /**
   * @deprecated
   */
  get directory(): Directory {
    // noinspection JSDeprecatedSymbols
    if (this.type === 'dir') {
      return this;
    } else {
      throw new Error('no directory available');
    }
  }

  /**
   * @deprecated
   */
  get file_id(): string {
    return this.hashId;
  }

  /**
   * @deprecated
   */
  get directoryParentId(): string {
    if (this.parent != null) {
      return this.parent.hashId;
    } else {
      return null;
    }
  }

  get mimeTypeLabel() {
    // TODO: Move this method to ObjectTypeProvider
    switch (this.mimeType) {
      case MimeTypes.Directory:
        return 'Folder';
      case MimeTypes.Map:
        return 'Map';
      case MimeTypes.BioC:
        return 'Bioc';
      case MimeTypes.EnrichmentTable:
        return 'Enrichment Table';
      case 'application/pdf':
        return 'Document';
      default:
        return 'File';
    }
  }

  get fontAwesomeIcon() {
    if (this.mimeType.startsWith('image/')) {
      return 'fa fa-file-image';
    } else if (this.mimeType.startsWith('video/')) {
      return 'fa fa-file-video';
    } else if (this.mimeType.startsWith('text/')) {
      return 'fa fa-file-alt';
    }

    // TODO: Move this method to ObjectTypeProvider
    switch (this.mimeType) {
      case MimeTypes.Directory:
        return FAClass.Directory;
      case MimeTypes.Map:
        return FAClass.Map;
      case MimeTypes.BioC:
        return FAClass.BioC;
      case MimeTypes.EnrichmentTable:
        return FAClass.EnrichmentTable;
      case MimeTypes.Graph:
        return FAClass.Graph;
      case MimeTypes.Pdf:
        return FAClass.Pdf;
      default:
        const matchedIcon = getSupportedFileCodes(this.filename);
        if (matchedIcon !== undefined) {
          return matchedIcon.FAClass;
        }
        return FAClass.Default;
    }
  }

  get fontAwesomeIconCode() {
    // TODO: Move this method to ObjectTypeProvider
    switch (this.mimeType) {
      case MimeTypes.Directory:
        return Unicodes.Directory;
      case MimeTypes.Map:
        return Unicodes.Map;
      case MimeTypes.BioC:
        return Unicodes.BioC;
      case MimeTypes.EnrichmentTable:
        return Unicodes.EnrichmentTable;
      case MimeTypes.Graph:
        return Unicodes.Graph;
      case MimeTypes.Pdf:
        return Unicodes.Pdf;
      default:
        const matchedIcon = getSupportedFileCodes(this.filename);
        if (matchedIcon !== undefined) {
          return matchedIcon.unicode;
        }
        return Unicodes.Default;
    }
  }

  get mapNodeLabel() {
    switch (this.mimeType) {
      case MimeTypes.Map:
        return 'map';
      default:
        return 'link';
    }
  }

  /**
   * @deprecated
   */
  get projectsId(): string {
    return this.project != null ? this.project.hashId : null;
  }

  /**
   * @deprecated
   */
  get type(): 'dir' | 'file' | 'map' {
    switch (this.mimeType) {
      case MimeTypes.Directory:
        return 'dir';
      case MimeTypes.Map:
        return 'map';
      default:
        return 'file';
    }
  }

  /**
   * @deprecated
   */
  get name(): string {
    return this.filename;
  }

  get effectiveName(): string {
    if (this.isDirectory && this.parent == null && this.project != null) {
      return this.project.name;
    } else {
      return this.filename;
    }
  }

  /**
   * @deprecated
   */
  get label(): string {
    return this.filename;
  }

  /**
   * @deprecated
   */
  get graph(): UniversalGraph {
    return null;
  }

  /**
   * @deprecated
   */
  get upload_url(): string {
    return this.uploadUrl;
  }

  /**
   * @deprecated
   */
  get annotations_date(): string {
    return this.annotationsDate;
  }

  /**
   * @deprecated
   */
  get annotationDate(): string {
    return this.annotationsDate;
  }

  /**
   * @deprecated
   */
  get creation_date(): string {
    return this.creationDate;
  }

  /**
   * @deprecated
   */
  get modified_date(): string {
    return this.modifiedDate;
  }

  /**
   * @deprecated
   */
  get modificationDate(): string {
    return this.modifiedDate;
  }

  /**
   * @deprecated
   */
  get creator(): User {
    return this.user;
  }

  /**
   * @deprecated
   */
  get id(): string {
    return this.hashId;
  }

  /**
   * @deprecated
   */
  get data(): Directory | KnowledgeMap | PdfFile {
    return this;
  }

  get new(): boolean {
    return this.creationDate === this.modifiedDate;
  }

  filterChildren(filter: string) {
    const normalizedFilter = this.normalizeFilter(filter);
    this.children.filter = normalizedFilter.length ? (item: FilesystemObject) => {
      return this.normalizeFilter(item.name).includes(normalizedFilter);
    } : null;
  }

  getCommands(forEditing = true): any[] {
    // TODO: Move this method to ObjectTypeProvider
    const projectName = this.project ? this.project.name : 'default';
    switch (this.mimeType) {
      case MimeTypes.Directory:
        // TODO: Convert to hash ID
        return ['/projects', projectName, 'folders', this.hashId];
      case MimeTypes.EnrichmentTable:
        return ['/projects', projectName, 'enrichment-table', this.hashId];
      case MimeTypes.Pdf:
        return ['/projects', projectName, 'files', this.hashId];
      case MimeTypes.BioC:
        return ['/projects', projectName, 'bioc', this.hashId];
      case MimeTypes.Map:
        return ['/projects', projectName, 'maps', this.hashId];
      case MimeTypes.Graph:
        return ['/projects', projectName, 'sankey', this.hashId];
      default:
        return ['/files', this.hashId];
    }
  }

  getURL(forEditing = true, meta?: Meta): string {
    // TODO: Move this method to ObjectTypeProvider
    const url = '/' + this.getCommands(forEditing).map(item => {
      return encodeURIComponent(item.replace(/^\//, ''));
    }).join('/');

    switch (this.mimeType) {
      case MimeTypes.EnrichmentTable:
        let fragment = '';
        if (!isNil(meta)) {
          fragment = '#' + [
            `id=${encodeURIComponent(meta.id)}`,
            `text=${encodeURIComponent(meta.allText)}`,
            `color=${encodeURIComponent(annotationTypesMap.get(meta.type.toLowerCase()).color)}`
          ].join('&');
        }
        return url + fragment;
      default:
        return url;
    }
  }

  getGraphEntitySources(meta?: Meta): Source[] {
    const sources = [];

    sources.push({
      domain: this.filename,
      url: this.getURL(false, meta),
    });

    if (this.doi != null) {
      sources.push({
        domain: 'DOI',
        url: this.doi,
      });
    }

    if (this.uploadUrl != null) {
      sources.push({
        domain: 'External URL',
        url: this.uploadUrl,
      });
    }

    return sources;
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    // TODO: Move to DataTransferData framework
    createObjectDragImage(this).addDataTransferData(dataTransfer);

    const filesystemObjectTransfer: FilesystemObjectTransferData = {
      hashId: this.hashId,
      privileges: this.privileges,
    };

    const sources: Source[] = this.getGraphEntitySources();

    const node: Partial<Omit<UniversalGraphNode, 'data'>> & { data: Partial<UniversalEntityData> } = {
      display_name: this.name,
      label: this.type === 'map' ? 'map' : 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.id + '',
        }],
        sources,
      },
    };

    dataTransfer.effectAllowed = 'all';
    dataTransfer.setData('text/plain', this.name);
    dataTransfer.setData(FILESYSTEM_OBJECT_TRANSFER_TYPE, JSON.stringify(filesystemObjectTransfer));
    dataTransfer.setData('application/lifelike-node', JSON.stringify(node));
  }

  private getId(): any {
    switch (this.type) {
      case 'dir':
        const directory = this.data as Directory;
        return directory.id;
      case 'file':
        const file = this.data as PdfFile;
        return file.file_id;
      case 'map':
        const _map = this.data as KnowledgeMap;
        return _map.hash_id;
      default:
        throw new Error(`unknown directory object type: ${this.type}`);
    }
  }

  private normalizeFilter(filter: string): string {
    return filter.trim().toLowerCase().replace(/[ _]+/g, ' ');
  }

  private defaultSort(a: FilesystemObject, b: FilesystemObject) {
    if (a.type === 'dir' && b.type !== 'dir') {
      return -1;
    } else if (a.type !== 'dir' && b.type === 'dir') {
      return 1;
    } else {
      const aDate = nullCoalesce(a.modificationDate, a.creationDate);
      const bDate = nullCoalesce(b.modificationDate, b.creationDate);

      if (aDate != null && bDate != null) {
        const aMoment = moment(aDate);
        const bMoment = moment(bDate);
        if (aMoment.isAfter(bMoment)) {
          return -1;
        } else if (aMoment.isBefore(bMoment)) {
          return 1;
        } else {
          return a.name.localeCompare(b.name);
        }
      } else if (aDate != null) {
        return -1;
      } else if (bDate != null) {
        return 1;
      } else {
        return a.name.localeCompare(b.name);
      }
    }
  }

  update(data: RecursivePartial<FilesystemObjectData>): FilesystemObject {
    if (data == null) {
      return this;
    }
    for (const key of [
      'hashId', 'filename', 'user', 'description', 'mimeType', 'doi', 'public',
      'annotationsDate', 'uploadUrl', 'highlight', 'fallbackOrganism',
      'creationDate', 'modifiedDate', 'recyclingDate', 'privileges', 'recycled',
      'effectivelyRecycled', 'fallbackOrganism', 'annotationConfigs', 'filePath',
      'trueFilename']) {
      if (key in data) {
        this[key] = data[key];
      }
    }
    if ('project' in data) {
      this.project = data.project != null ? new ProjectImpl().update(data.project) : null;
    }
    if ('parent' in data) {
      if (data.parent != null) {
        const parent = new FilesystemObject();
        if (this.project != null) {
          parent.project = this.project;
        }
        this.parent = parent.update(data.parent);
      } else {
        this.parent = null;
      }
    }
    if ('children' in data) {
      if (data.children != null) {
        this.children.replace(data.children.map(
          itemData => {
            const child = new FilesystemObject();
            child.parent = this;
            if (this.project != null) {
              child.project = this.project;
            }
            return child.update(itemData);
          }));
      } else {
        this.children.replace([]);
      }
    }
    return this;
  }

  get root(): FilesystemObject {
    let root: FilesystemObject = this;
    while (root.parent != null) {
      root = root.parent;
    }
    return root;
  }
}

export interface PathLocator {
  projectName?: string;
  directoryId?: string;
}

export function createProjectDragImage(project: ProjectImpl): DragImage {
  return createDragImage(project.name, '\uf5fd');
}

export function createObjectDragImage(object: FilesystemObject): DragImage {
  return createDragImage(object.filename, object.fontAwesomeIconCode);
}
