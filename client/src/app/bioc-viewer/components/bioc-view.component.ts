import { Component, EventEmitter, OnDestroy, Output, ViewChild, HostListener, ElementRef } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';

import { NgbDropdown, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { uniqueId } from 'lodash-es';
import { BehaviorSubject, combineLatest, Observable, Subject, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

import { ENTITY_TYPES, EntityType } from 'app/shared/annotation-types';
import { ProgressDialog } from 'app/shared/services/progress-dialog.service';
import { BiocFile } from 'app/interfaces/bioc-files.interface';
import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { WorkspaceManager } from 'app/shared/workspace-manager';
import { mapBlobToBuffer, mapBufferToJsons } from 'app/shared/utils/files';
import { SearchControlComponent } from 'app/shared/components/search-control.component';
import { Location, BiocAnnotationLocation } from 'app/pdf-viewer/annotation-type';
import { SEARCH_LINKS } from 'app/shared/links';
import { UniversalGraphNode } from 'app/drawing-tool/services/interfaces';
import { FilesystemService } from 'app/file-browser/services/filesystem.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { FilesystemObjectActions } from 'app/file-browser/services/filesystem-object-actions';


@Component({
  selector: 'app-bioc-viewer',
  templateUrl: './bioc-view.component.html',
  styleUrls: ['./bioc-view.component.scss'],
})
export class BiocViewComponent implements OnDestroy, ModuleAwareComponent {
  @ViewChild('dropdown', { static: false, read: NgbDropdown }) dropdownComponent: NgbDropdown;
  @ViewChild('searchControl', {
    static: false,
    read: SearchControlComponent,
  }) searchControlComponent: SearchControlComponent;
  @Output() requestClose: EventEmitter<any> = new EventEmitter();
  @Output() fileOpen: EventEmitter<BiocFile> = new EventEmitter();

  id = uniqueId('FileViewComponent-');

  paramsSubscription: Subscription;
  returnUrl: string;

  entityTypeVisibilityMap: Map<string, boolean> = new Map();
  @Output() filterChangeSubject = new Subject<void>();

  searchChanged: Subject<{ keyword: string, findPrevious: boolean }> = new Subject<{ keyword: string, findPrevious: boolean }>();
  searchQuery = '';
  goToPosition: Subject<Location> = new Subject<Location>();
  highlightAnnotations = new BehaviorSubject<{
    id: string;
    text: string;
  }>(null);
  highlightAnnotationIds: Observable<string> = this.highlightAnnotations.pipe(
    map((value) => value ? value.id : null),
  );
  loadTask: any;
  pendingScroll: Location;
  pendingAnnotationHighlightId: string;
  openbiocSub: Subscription;
  openStatusSub: Subscription;
  ready = false;
  object?: FilesystemObject;
  // Type information coming from interface biocSource at:
  // https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/biocjs-dist/index.d.ts
  biocData: Array<Document>;
  currentFileId: string;
  addAnnotationSub: Subscription;
  removedAnnotationIds: string[];
  removeAnnotationSub: Subscription;
  biocFileLoaded = false;
  entityTypeVisibilityChanged = false;
  modulePropertiesChange = new EventEmitter<ModuleProperties>();
  addAnnotationExclusionSub: Subscription;
  showExcludedAnnotations = false;
  removeAnnotationExclusionSub: Subscription;

  matchesCount = {
    current: 0,
    total: 0,
  };
  searching = false;

  selectedText = '';
  createdNode;

  constructor(
    protected readonly filesystemService: FilesystemService,
    protected readonly fileObjectActions: FilesystemObjectActions,
    protected readonly snackBar: MatSnackBar,
    protected readonly modalService: NgbModal,
    protected readonly route: ActivatedRoute,
    protected readonly errorHandler: ErrorHandler,
    protected readonly progressDialog: ProgressDialog,
    protected readonly workSpaceManager: WorkspaceManager,
    protected readonly _elemenetRef: ElementRef
  ) {
    this.loadTask = new BackgroundTask(([hashId]) => {
      return combineLatest(
        this.filesystemService.get(hashId),
        this.filesystemService.getContent(hashId).pipe(
          mapBlobToBuffer(),
          mapBufferToJsons()
        )
      );
    });

    this.paramsSubscription = this.route.queryParams.subscribe(params => {
      this.returnUrl = params.return;
    });

    // Listener for file open
    this.openbiocSub = this.loadTask.results$.subscribe(({
      result: [object, content],
      value: [file],
    }) => {
      this.biocData = content.splice(0, 1);
      const ref = (this.biocData[0] as any).passages.findIndex((p: any) => p.infons.section_type === 'REF');
      if (ref > -1) {
        // then insert here the References Title
        const referencesTitleObj: any = {};
        referencesTitleObj.infons = {
          section_type: 'INTRO',
          type: 'title_1'
        };
        referencesTitleObj.offset = 0;
        referencesTitleObj.annotations = [];
        referencesTitleObj.text = 'References';
        ((this.biocData[0] as any).passages as any[]).splice(ref, 0, referencesTitleObj);
      }
      this.object = object;
      this.emitModuleProperties();

      this.currentFileId = object.hashId;
      this.ready = true;
    });

    this.openStatusSub = this.loadTask.status$.subscribe((data) => {
      if (data.resultsShown) {
        const fragment = (this.route.snapshot.fragment || '');
        if (fragment.indexOf('offset') >= 0) {
          setTimeout(() => {
            this.scrollInOffset(this.parseLocationFromUrl(fragment));
          }, 1000);
        }
      }
    });

    this.loadFromUrl();
  }

  getFigureCaption(passage) {
    return passage.infons.id || 'Fig';
  }

  isGeneric(passage) {
    return !this.isTableView(passage) && !this.isFigure(passage);
  }

  isTableView(passage) {
    const TYPES = ['table', 'table_caption', 'table_footnote'];
    const infons = passage.infons || {};
    const type = infons.type && infons.type.toLowerCase();
    const res = TYPES.includes(type);
    return res;
  }

  isFigure(passage) {
    const TYPES = ['fig_caption', 'fig_caption_title'];
    const infons = passage.infons || {};
    const type = infons.type && infons.type.toLowerCase();
    const res = TYPES.includes(type);
    return res;
  }

  buildFigureLink(doc, passage) {
    const pmcid = doc.passages.find(p => p.infons['article-id_pmc']);
    const infons = passage.infons || {};
    const file = infons.file;
    return `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${pmcid.infons['article-id_pmc']}/bin/${file}`;
  }

  pmid(doc) {
    const pmid = doc.passages.find(p => p.infons['article-id_pmid']);
    if (pmid) {
      const PMID_LINK = 'https://www.ncbi.nlm.nih.gov/pubmed/' + String(pmid.infons['article-id_pmid']);
      const text = 'PMID' + String(pmid.infons['article-id_pmid']);
      return [text, PMID_LINK];
    }
    const pmc = doc.passages.find(p => p.infons['article-id_pmc']);
    if (pmc) {
      const PMCID_LINK = 'http://www.ncbi.nlm.nih.gov/pmc/articles/pmc' + String(pmc.infons['article-id_pmc']);
      const text = 'PMC' + String(pmc.infons['article-id_pmc']);
      return [text, PMCID_LINK];
    }

    return [];
  }

  journal(doc) {
    const journal = doc.passages.find(p => p.infons[`journal`]);
    if (journal) {
      return journal.infons[`journal`];
    }
  }

  authors(doc) {
    const authors = doc.passages.find(p => p.infons[`authors`]);
    if (authors) {
      return authors.infons[`authors`];
    }
  }

  year(doc) {
    const year = doc.passages.find(p => p.infons[`year`]);
    if (year) {
      return year.infons[`year`];
    }
  }

  title(doc) {
    try {
      return doc.passages.find(p => p.infons.type.toLowerCase() === 'title' || p.infons.section_type.toLowerCase() === 'title').text;
    } catch (e) {
      return doc.pmid;
    }
  }

  loadFromUrl() {
    // Check if the component was loaded with a url to parse fileId
    // from
    if (this.route.snapshot.params.file_id) {
      this.object = null;
      this.currentFileId = null;

      const linkedFileId = this.route.snapshot.params.file_id;
      const fragment = this.route.snapshot.fragment || '';
      // TODO: Do proper query string parsing
      this.openbioc(linkedFileId);
    }
  }

  requestRefresh() {
    if (confirm('There have been some changes. Would you like to refresh this open document?')) {
      this.loadFromUrl();
    }
  }

  isEntityTypeVisible(entityType: EntityType) {
    const value = this.entityTypeVisibilityMap.get(entityType.id);
    if (value === undefined) {
      return true;
    } else {
      return value;
    }
  }

  scrollInOffset(params: BiocAnnotationLocation) {
    if (!isNaN(Number(params.offset))) {
      const query = `span[offset='${params.offset}']`;
      const annotationElem = this._elemenetRef.nativeElement.querySelector(query);
      if (annotationElem) {
        annotationElem.scrollIntoView({ block: 'center' });
        jQuery(annotationElem).css('border', '2px solid #D62728');
        jQuery(annotationElem).animate({
          borderLeftColor: 'white',
          borderTopColor: 'white',
          borderRightColor: 'white',
          borderBottomColor: 'white',
        }, 1000);
      }
    }
    // if start and end exists then
    // then it is frictionless drag and drop
    if (params.start && params.len) {
      const query = `span[position='${params.offset}']`;
      const annotationElem = this._elemenetRef.nativeElement.querySelector(query);
      const range = document.createRange();
      range.setStart(annotationElem.firstChild, Number(params.start));
      range.setEnd(annotationElem.firstChild, Number(params.start) + Number(params.len));
      const newNode = document.createElement('span');
      newNode.style['background-color'] = 'rgba(255, 255, 51, 0.3)';
      jQuery(newNode).css('border', '2px solid #D62728');
      range.surroundContents(newNode);
      this.createdNode = newNode;
      if (newNode) {
        newNode.scrollIntoView({ block: 'center' });
        jQuery(newNode).animate({
          borderLeftColor: 'white',
          borderTopColor: 'white',
          borderRightColor: 'white',
          borderBottomColor: 'white',
        }, 1000);
        setTimeout(() => {
          this.removeFrictionlessNode();
        }, 800);
      }
    }
  }

  setAllEntityTypesVisibility(state: boolean) {
    for (const type of ENTITY_TYPES) {
      this.entityTypeVisibilityMap.set(type.id, state);
    }
    this.invalidateEntityTypeVisibility();
  }

  changeEntityTypeVisibility(entityType: EntityType, event) {
    this.entityTypeVisibilityMap.set(entityType.id, event.target.checked);
    this.invalidateEntityTypeVisibility();
  }

  invalidateEntityTypeVisibility() {
    // Keep track if the user has some entity types disabled
    let entityTypeVisibilityChanged = false;
    for (const value of this.entityTypeVisibilityMap.values()) {
      if (!value) {
        entityTypeVisibilityChanged = true;
        break;
      }
    }
    this.entityTypeVisibilityChanged = entityTypeVisibilityChanged;

    this.filterChangeSubject.next();
  }

  closeFilterPopup() {
    this.dropdownComponent.close();
  }

  /**
   * Open bioc by file_id along with location to scroll to
   * @param hashId - represent the bioc to open
   */
  openbioc(hashId: string) {
    if (this.object != null && this.currentFileId === this.object.hashId) {
      return;
    }
    this.biocFileLoaded = false;
    this.ready = false;

    this.loadTask.update([hashId]);
  }

  ngOnDestroy() {
    if (this.paramsSubscription) {
      this.paramsSubscription.unsubscribe();
    }
    if (this.openbiocSub) {
      this.openbiocSub.unsubscribe();
    }
    if (this.addAnnotationSub) {
      this.addAnnotationSub.unsubscribe();
    }
    if (this.removeAnnotationSub) {
      this.removeAnnotationSub.unsubscribe();
    }
    if (this.addAnnotationExclusionSub) {
      this.addAnnotationExclusionSub.unsubscribe();
    }
    if (this.removeAnnotationExclusionSub) {
      this.removeAnnotationExclusionSub.unsubscribe();
    }
    if (this.openStatusSub) {
      this.openStatusSub.unsubscribe();
    }
  }

  scrollInbioc(loc: Location) {
    this.pendingScroll = loc;
    if (!this.biocFileLoaded) {
      console.log('File in the bioc viewer is not loaded yet. So, I cant scroll');
      return;
    }
    this.goToPosition.next(loc);
  }

  loadCompleted(status) {
    this.biocFileLoaded = status;
    if (this.pendingScroll) {
      this.scrollInbioc(this.pendingScroll);
    }
    if (this.pendingAnnotationHighlightId) {
      this.pendingAnnotationHighlightId = null;
    }
  }

  close() {
    this.requestClose.emit(null);
  }

  findPrevious() {
    this.searchChanged.next({
      keyword: this.searchQuery,
      findPrevious: true,
    });
  }

  emitModuleProperties() {
    this.modulePropertiesChange.next({
      title: this.object.filename,
      fontAwesomeIcon: 'file',
    });
  }

  parseHighlightFromUrl(fragment: string): string | undefined {
    if (window.URLSearchParams) {
      const params = new URLSearchParams(fragment);
      return params.get('annotation');
    }
    return null;
  }


  openFileNavigatorPane() {
    const url = `/file-navigator/${this.object.project.name}/${this.object.hashId}`;
    this.workSpaceManager.navigateByUrl({url, extras: { sideBySide: true, newTab: true }});
  }

  dragStarted(event: DragEvent) {
    const dataTransfer: DataTransfer = event.dataTransfer;
    dataTransfer.setData('text/plain', this.object.filename);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: this.object.filename,
      label: 'link',
      sub_labels: [],
      data: {
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.object.hashId + '',
        }],
        sources: [{
          domain: this.object.filename,
          url: ['/projects', encodeURIComponent(this.object.project.name), 'bioc',
            'files', encodeURIComponent(this.object.hashId)].join('/'),
        }],
      },
    } as Partial<UniversalGraphNode>));
  }

  @HostListener('dragend', ['$event'])
  dragEnd(event: (DragEvent & { path: Element[] } )) {
    const paths = event.path;
    const biocViewer = paths.filter((el) => el.tagName && el.tagName.toLowerCase() === 'app-bioc-viewer');
    if (biocViewer.length > 0) {
      const firstPath = paths[0];
      if (!firstPath.tagName) {
        // then this is frictionless drag and drop
        this.removeFrictionlessNode();
      }
    }
  }

  removeFrictionlessNode() {
    // I will replace this code
    if (this.createdNode && this.createdNode.parentNode) {
      const wholeText = this.createdNode.parentNode.textContent;
      const parent = this.createdNode.parentNode;
      this.createdNode.parentNode.replaceChild(document.createTextNode(this.selectedText), this.createdNode);
      this.createdNode = null;
      jQuery(parent).text(wholeText);
    }
  }

  @HostListener('document:mouseup', ['$event'])
  selectionChange(event: (MouseEvent & { target: Element })) {
    const isItComingFromBiocViewer = (event.target).closest('app-bioc-viewer');
    if (!isItComingFromBiocViewer) {
      return;
    }
    this.removeFrictionlessNode();
    const selection = window.getSelection();
    const selectedText = selection.toString();
    if (selectedText && selectedText.length > 0) {
      const range = window.getSelection().getRangeAt(0);
      this.selectedText = selection.toString();
      // create a new DOM node and set it's style property to something yellowish.
      const newNode = document.createElement('span');
      newNode.style['background-color'] = 'rgba(255, 255, 51, 0.3)';
      newNode.setAttribute('draggable', 'true');
      this.createdNode = newNode;

      try {
        // surround the selection with the new span tag
        range.surroundContents(this.createdNode);
      } catch (e) {
        window.getSelection().empty();
      }

      const ann = jQuery(this.createdNode).parent();
      const offset = jQuery(ann).attr('position');
      const parentText: string = ann.text();
      const createdText = jQuery(this.createdNode).text();
      const innerIndex = parentText.indexOf(createdText);
      jQuery(this.createdNode).attr('start', innerIndex);
      jQuery(this.createdNode).attr('len', createdText.length);
      return false;
    }
  }

  reBindType(type: string) {
    const typeMap = {
      SNP: 'Mutation',
      DNAMutation: 'Mutation',
      ProteinMutation: 'Mutation',
      CellLine: 'Species'
    };
    return typeMap[type] ? typeMap[type] : type;
  }

  parseLocationFromUrl(fragment: string): BiocAnnotationLocation {
    const params = new URLSearchParams(fragment);
    return {
      offset: params.get('offset'),
      start: params.get('start'),
      len: params.get('len')
    };
  }

  @HostListener('dragstart', ['$event'])
  dragStart(event: DragEvent) {
    // I will replace this code
    const meta: any = {};
    const dataTransfer: DataTransfer = event.dataTransfer;
    const txt = (event.target as any).innerHTML;
    const clazz = (event.target as any).classList;
    const type = this.reBindType((clazz && clazz.length > 1) ? clazz[1] : 'link');
    const pmcidFomDoc = this.pmid(this.biocData[0]);
    const pmcid = ({
      domain: pmcidFomDoc[0],
      url: pmcidFomDoc[1]
    });
    if (!clazz || clazz.value === '') {
      const node = jQuery((event as any).path[1]);
      const position = jQuery(node).parent().attr('position');
      const startIndex = jQuery(node).attr('start');
      const len = jQuery(node).attr('len');
      let source = ['/projects', encodeURIComponent(this.object.project.name),
        'bioc', encodeURIComponent(this.object.hashId)].join('/');
      if (position) {
        source += '#';
        source += new URLSearchParams({
          offset: position,
          start: startIndex,
          len
        });
      }
      const link = meta.idHyperlink || '';
      dataTransfer.setData('text/plain', this.selectedText);
      dataTransfer.setData('application/lifelike-node', JSON.stringify({
        display_name: 'Link',
        label: 'link',
        data: {
          sources: [{
            domain: this.object.filename,
            url: source
          }, pmcid],
          detail: this.selectedText,
          references: [{
            type: 'PROJECT_OBJECT',
            id: this.object.hashId,
          }, {
            type: 'DATABASE',
            url: link,
          }]
        },
        style: {
          showDetail: true,
        },
      } as Partial<UniversalGraphNode>));
      return;
    }
    const id = ((event.target as any).attributes[`identifier`] || {}).nodeValue;
    const annType = ((event.target as any).attributes[`annType`] || {}).nodeValue;
    const src = this.getSource({
      identifier: id,
      type: annType
    });
    const offset = ((event.target as any).attributes[`offset`] || {}).nodeValue;
    const search = [];
    const hyperlinks = [];
    const url = src;
    const domain = new URL(src).hostname.replace(/^www\./i, '');
    hyperlinks.push({ url, domain });
    const hyperlink = meta.idHyperlink || '';
    let sourceUrl = ['/projects', encodeURIComponent(this.object.project.name),
      'bioc', encodeURIComponent(this.object.hashId)].join('/');
    if (offset) {
      sourceUrl += '#offset=' + offset;
    }
    dataTransfer.setData('text/plain', txt);
    dataTransfer.setData('application/lifelike-node', JSON.stringify({
      display_name: txt,
      label: String(type).toLowerCase() === 'text-truncate' ? 'link' : String(type).toLowerCase(),
      sub_labels: [],
      data: {
        sources: [{
          domain: this.object.filename,
          url: sourceUrl
        }, pmcid],
        search,
        references: [{
          type: 'PROJECT_OBJECT',
          id: this.object.hashId,
        }, {
          type: 'DATABASE',
          url: hyperlink,
        }],
        hyperlinks,
        detail: meta.type === 'link' ? meta.allText : '',
      },
      style: {
        showDetail: meta.type === 'link',
      },
    } as Partial<UniversalGraphNode>));
    event.stopPropagation();
  }

  getSource(payload: any = {}) {
    // I will replace this code
    const identifier = payload.identifier || payload.Identifier;
    const type = payload.type;

    // MESH Handling
    if (identifier && identifier.toLowerCase().startsWith('mesh')) {
      const mesh = SEARCH_LINKS.find((a) => a.domain.toLowerCase() === 'mesh');
      const url = mesh.url;
      const idPart = identifier.split(':');
      return url.replace(/%s/, encodeURIComponent(idPart[1]));
    }

    // NCBI
    if (identifier && !isNaN(Number(identifier))) {
      let domain = 'ncbi';
      if (type === 'Species') {
        domain = 'ncbi_taxonomy';
      }
      const mesh = SEARCH_LINKS.find((a) => a.domain.toLowerCase() === domain);
      const url = mesh.url;
      return url.replace(/%s/, encodeURIComponent(identifier));
    }
    const fallback = SEARCH_LINKS.find((a) => a.domain.toLowerCase() === 'google');
    return fallback.url.replace(/%s/, encodeURIComponent(identifier));
  }

}

