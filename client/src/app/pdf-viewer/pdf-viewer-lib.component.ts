import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  ViewEncapsulation,
  ComponentFactoryResolver,
  ApplicationRef,
  Injector,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ComponentPortal, DomPortalOutlet } from '@angular/cdk/portal';

import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { escape, isNil, uniqueId, defer, forEach } from 'lodash-es';
import { Observable, Subject, Subscription } from 'rxjs';

import { DatabaseLink, EntityType, ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { SEARCH_LINKS } from 'app/shared/links';
import { ErrorHandler } from 'app/shared/services/error-handler.service';
import { toValidLink } from 'app/shared/utils/browser';
import { openModal } from 'app/shared/utils/modals';
import { IS_MAC } from 'app/shared/utils/platform';
import { InternalSearchService } from 'app/shared/services/internal-search.service';

import { PageViewport } from 'pdfjs-dist/types/display/display_utils';
import { PDFDocumentProxy } from 'pdfjs-dist/types/display/api';
import { AddedAnnotationExclusion, Annotation, Location, Meta, Rect, RemovedAnnotationExclusion, } from './annotation-type';
import { AnnotationEditDialogComponent } from './components/annotation-edit-dialog.component';
import { AnnotationExcludeDialogComponent } from './components/annotation-exclude-dialog.component';
import { PdfViewerComponent } from './pdf-viewer/pdf-viewer.component';
import { FindState, RenderTextMode } from './utils/constants';
import { PDFSource, PDFProgressData, PDFPageRenderEvent, PDFPageView, TextLayerBuilder, ScrollDestination } from './pdf-viewer/interfaces';
import { AnnotationToolbarComponent } from './components/annotation-toolbar.component';

declare var jQuery: any;

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'lib-pdf-viewer-lib',
  templateUrl: './pdf-viewer-lib.component.html',
  styleUrls: ['./pdf-viewer-lib.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class PdfViewerLibComponent implements OnInit, OnDestroy {

  @ViewChild('container', {static: true}) containerRef: ElementRef;

  @Input() searchChanged: Subject<{ keyword: string, findPrevious: boolean }>;
  private searchChangedSub: Subscription;
  @Input() pdfSrc: PDFSource;
  @Input() annotations: Annotation[];
  @Input() goToPosition: Subject<Location>;
  @Input() highlightAnnotations: Observable<string>;
  @Input() debugMode: boolean;
  @Input() entityTypeVisibilityMap: Map<string, boolean> = new Map();
  @Input() filterChanges: Observable<void>;
  renderTextMode: RenderTextMode = RenderTextMode.ENHANCED;
  currentHighlightAnnotationId: string | undefined;
  foundHighlightAnnotations: Annotation[] = [];
  currentHighlightAnnotationsIndex = 0;
  private filterChangeSubscription: Subscription;
  searching = false;

  @Input()
  set addedAnnotations(annotations: Annotation[]) {
    if (annotations) {
      annotations.forEach(annotation => {
        this.addAnnotation(annotation, annotation.pageNumber);
        this.annotations.push(annotation);
        this.updateAnnotationVisibility(annotation);
      });
    }
  }

  @Input()
  set removedAnnotationIds(uuids: string[]) {
    if (uuids) {
      const removedAnnotations = this.annotations.filter((ann: Annotation) => uuids.includes(ann.uuid));
      removedAnnotations.forEach((ann: Annotation) => {
        const ref = this.annotationHighlightElementMap.get(ann);
        jQuery(ref).remove();
      });
      this.annotations = this.annotations.filter((ann: Annotation) => !uuids.includes(ann.uuid));
    }
  }

  @Input()
  set addedAnnotationExclusion(exclusionData: AddedAnnotationExclusion) {
    if (exclusionData) {
      this.markAnnotationExclusions(exclusionData);
    }
  }

  @Input()
  set removedAnnotationExclusion(exclusionData: RemovedAnnotationExclusion) {
    if (exclusionData) {
      this.unmarkAnnotationExclusions(exclusionData);
    }
  }

  // tslint:disable-next-line: variable-name
  private _showExcludedAnnotations: boolean;
  @Input()
  set showExcludedAnnotations(showExcludedAnnotations: boolean) {
    this._showExcludedAnnotations = showExcludedAnnotations;
    this.renderFilterSettings();
  }

  get showExcludedAnnotations() {
    return this._showExcludedAnnotations;
  }

  @Output() loadCompleted = new EventEmitter();
  @Output() annotationDragStart = new EventEmitter<AnnotationDragEvent>();
  // tslint:disable
  @Output('custom-annotation-created') annotationCreated = new EventEmitter();
  @Output('custom-annotation-removed') annotationRemoved = new EventEmitter();
  @Output('annotation-exclusion-added') annotationExclusionAdded = new EventEmitter();
  @Output('annotation-exclusion-removed') annotationExclusionRemoved = new EventEmitter();
  @Output() searchChange = new EventEmitter<string>();
  @Output() annotationHighlightChange = new EventEmitter<AnnotationHighlightResult>();
  @Output() goToPositionVisit = new EventEmitter<Location>();

  /**
   * Stores a mapping of annotations to the HTML elements that are used to show it.
   */
  private readonly annotationHighlightElementMap: Map<Annotation, HTMLElement[]> = new Map();

  pendingHighlights = {};

  error: any;
  page = 1;
  rotation = 0;
  zoom = 1.0;
  originalSize = false;
  pdf: any;
  renderText = true;
  progressData: PDFProgressData;
  isLoaded = false;
  isLoadCompleted = false;
  stickToPage = false;
  showAll = true;
  autoresize = true;
  fitToPage = false;
  outline: any[];
  isOutlineShown = false;
  pdfQuery = '';
  allPages = 0;
  currentRenderedPage = 0;
  showNextFindFeedback = false;
  goToPositionVisitAfterFind: Location | undefined = null;

  pageRef: { [idx: number]: PDFPageView } = {};
  index: any;

  allText: string;
  selectedText: string[];
  selectedTextCoords: Rect[];
  currentPage: number;
  selectedElements: HTMLElement[] = [];

  opacity = 0.3;

  dragAndDropOriginCoord;
  dragAndDropOriginHoverCount;
  dragAndDropDestinationCoord;
  dragAndDropDestinationHoverCount;

  pdfViewerId = uniqueId();

  matchesCount = {
    current: 0,
    total: 0,
  };

  searchCommand: string;

  private firstAnnotationRange: Range | undefined;
  private requestAnimationFrameId: number | undefined;

  @ViewChild(PdfViewerComponent, {static: false})
  private pdfComponent: PdfViewerComponent;

  constructor(
    protected readonly elementRef: ElementRef,
    protected readonly modalService: NgbModal,
    private cfr: ComponentFactoryResolver,
    private appRef: ApplicationRef,
    private injector: Injector,
    protected readonly zone: NgZone,
    protected readonly snackBar: MatSnackBar,
    protected readonly errorHandler: ErrorHandler,
    protected readonly internalSearch: InternalSearchService,
  ) {
  }

  ngOnInit() {
    this.pdfViewerRef[this.pdfViewerId] = {
      openAnnotationPanel: () => this.zone.run(() => this.openAnnotationPanel()),
      copySelectedText: () => this.zone.run(() => this.copySelectedText()),
      removeCustomAnnotation: (uuid) => this.zone.run(() => this.removeCustomAnnotation(uuid)),
      openExclusionPanel: (annExclusion) => this.zone.run(() => this.openExclusionPanel(annExclusion)),
      removeAnnotationExclusion: (annExclusion) => this.zone.run(() => this.removeAnnotationExclusion(annExclusion)),
      highlightAllAnnotations: (id, toggle = true) => this.zone.run(() => this.highlightAllAnnotations(id, toggle)),
    };

    this.goToPosition.subscribe((sub) => {
      if (!this.isLoadCompleted && sub) {
        // Pdf viewer is not ready to go to a position
        return;
      }
      if (sub != null) {
        if (sub.pageNumber != null) {
          this.addHighlightItem(sub.pageNumber, sub.rect);
          this.goToPositionVisit.emit(sub);
        } else if (sub.jumpText != null) {
          const simplified = sub.jumpText.replace(/[\s\r\n]/g, ' ').trim();
          const words = simplified.split(/ /g);
          const prefixQuery = words.splice(0, 4).join(' ');
          this.showNextFindFeedback = true;
          this.searchQueryChanged({
            keyword: prefixQuery,
            findPrevious: true,
          });
          this.goToPositionVisitAfterFind = sub;
        } else {
          this.goToPositionVisit.emit(sub);
        }
      }
    });

    this.highlightAnnotations.subscribe((sub) => {
      if (!this.isLoadCompleted && sub) {
        // Pdf viewer is not ready to go to a position
        return;
      }
      this.highlightAllAnnotations(sub);
    });

    if (this.debugMode) {
      jQuery(document).on('click', '.system-annotation', event => {
        const target = event.target;
        const location = JSON.parse(jQuery(target).attr('location')) as Location;
        const meta = JSON.parse(jQuery(target).attr('meta')) as Meta;
      });
    }

    if (this.filterChanges) {
      this.filterChangeSubscription = this.filterChanges.subscribe(() => this.renderFilterSettings());
    }

    this.searchChangedSub = this.searchChanged.subscribe((sb) => {
      this.searchQueryChanged(sb);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.requestAnimationFrameId);

    if (this.filterChangeSubscription) {
      this.filterChangeSubscription.unsubscribe();
    }

    if (this.searchChangedSub) {
      this.searchChangedSub.unsubscribe();
    }

    this.textLayerPortalOutlets.forEach(p => p.dispose());

    delete this.pdfViewerRef[this.pdfViewerId];
  }

  get pdfViewerRef() {
    return 'pdfViewerRef' in (window as any) ?
      (window as any).pdfViewerRef :
      (window as any).pdfViewerRef = {};
  }

  renderFilterSettings() {
    for (const annotation of this.annotations) {
      this.updateAnnotationVisibility(annotation);
    }
  }

  updateAnnotationVisibility(annotation: Annotation) {
    let visible = this.entityTypeVisibilityMap.get(annotation.meta.type);
    if (visible == null) {
      visible = true;
    }
    const elements = this.annotationHighlightElementMap.get(annotation);
    if (elements) {
      for (const element of elements) {
        if (visible && (!annotation.meta.isExcluded || (annotation.meta.isExcluded && this.showExcludedAnnotations))) {
          element.style.display = 'block';
        } else {
          element.style.display = 'none';
        }
      }
    }
  }

  addAnnotation(annotation: Annotation, pageNum: number) {
    // each annotation should have allText field set.
    const allText = (annotation.keywords || []).join(' ');
    if (!annotation.meta.allText || annotation.meta.allText === '') {
      annotation.meta.allText = allText;
    }

    // Do NOT attempt to draw an annotation if the corresponding page has yet to be rendered! (It will get drawn on-demand)
    if (!isNil(this.pageRef[pageNum])) {
      const pdfPageView = this.pageRef[pageNum];
      const viewPort: PageViewport = pdfPageView.viewport;
      const elementRefs = [];
      this.annotationHighlightElementMap.set(annotation, elementRefs);

      for (const rect of annotation.rects) {
        const bounds = viewPort.convertToViewportRectangle(rect);
        const left = Math.min(bounds[0], bounds[2]);
        let top = Math.min(bounds[1], bounds[3]);
        const width = Math.abs(bounds[0] - bounds[2]);
        const height = Math.abs(bounds[1] - bounds[3]);
        const overlayContainer = pdfPageView.div;
        const overlayDiv = document.createElement('div');
        const location: Location = {
          pageNumber: annotation.pageNumber,
          rect,
        };
        overlayDiv.setAttribute('draggable', 'true');
        overlayDiv.addEventListener('dragstart', event => {
          this.annotationDragStart.emit({
            event,
            meta: annotation.meta,
            location,
          });
          event.stopPropagation();
        });
        overlayDiv.dataset.annotationId = annotation.meta.id;
        overlayDiv.setAttribute('class', 'system-annotation'
          + (this.currentHighlightAnnotationId === annotation.meta.id
            ? ' annotation-highlight' : ''));
        overlayDiv.setAttribute('location', JSON.stringify(location));
        overlayDiv.setAttribute('meta', JSON.stringify(annotation.meta));
        top = this.normalizeTopCoordinate(top, annotation);
        const opacity = this.normalizeOpacityLevel(annotation);
        const bgcolor = this.normalizeBackgroundColor(annotation);
        overlayDiv.setAttribute('style', `opacity:${escape(String(opacity))}; background-color: ${escape(bgcolor)};position:absolute;` +
          'left:' + left + 'px;top:' + (top) + 'px;width:' + width + 'px;height:' + height + 'px');
        overlayContainer.appendChild(overlayDiv);
        (annotation as any).ref = overlayDiv;
        elementRefs.push(overlayDiv);
        jQuery(overlayDiv).css('cursor', 'move');
        (jQuery(overlayDiv) as any).qtip(
          {
            content: this.prepareTooltipContent(annotation),
            position: {
              my: 'top center',
              at: 'bottom center',
              viewport: false,
              target: [left + width / 2, top + height],
              container: jQuery(overlayContainer),
            },
            style: {
              classes: 'qtip-bootstrap',
              tip: {
                width: 16,
                height: 8,
              },
            },
            show: {
              delay: 10,
              event: 'click',
              solo: true,
            },
            hide: {
              fixed: true,
              delay: 150,
              event: 'unfocus',
            },
          },
        );
      }
    }

    if (this.pendingHighlights[pageNum]) {
      const rect = this.pendingHighlights[pageNum];
      delete this.pendingHighlights[pageNum];
      this.addHighlightItem(pageNum, rect);
    }

    this.updateAnnotationVisibility(annotation);
  }

  normalizeTopCoordinate(top: number, an: Annotation): number {
    if (an && an.meta && an.meta.isCustom) {
      return top + 2;
    }
    if (an && an.meta && !an.meta.isCustom) {
      return top - 2;
    }
    return top;
  }

  normalizeOpacityLevel(an: Annotation) {
    const t = an.meta.type.toLowerCase();
    return this.opacity;
  }

  normalizeBackgroundColor(an: Annotation): string {
    return ENTITY_TYPE_MAP[an.meta.type].color;
  }

  /**
   * TODO: Make a reuseable function to create this tooltip to keep things consistent.
   * Currently also used in AnnotationTagHandler.prepareTooltipContent()
   *  - collapsing does not work there, maybe has to do with using Renderer2Factory and stopPropagation
   * @param an
   * @returns
   */
  prepareTooltipContent(an: Annotation): string {
    let base = [`Type: ${an.meta.type}`];
    let idLink: DatabaseLink = null;
    const annoId = an.meta.id.indexOf(':') !== -1 ? an.meta.id.split(':')[1] : an.meta.id;

    if (ENTITY_TYPE_MAP.hasOwnProperty(an.meta.type)) {
      const source = ENTITY_TYPE_MAP[an.meta.type] as EntityType;
      idLink = source.links.filter(link => link.name === an.meta.idType)[0];
    }

    // null/undefined because a data source did not match
    // e.g we use "Custom" for phenotype
    if (idLink !== null && idLink !== undefined) {
      base.push(annoId && annoId.indexOf('NULL') === -1 ? `Id: <a href=${escape(`${idLink.url}${annoId}`)} target="_blank">${escape(annoId)}</a>` : 'Id: None');
    } else {
      base.push(annoId && annoId.indexOf('NULL') === -1 ? `Id: ${escape(annoId)}` : 'Id: None');
    }
    base.push(an.meta.idType && an.meta.idType !== '' ? `Data Source: ${escape(an.meta.idType)}` : 'Data Source: None');

    if (an.meta.isCustom) {
      base.push(`User generated annotation`);
    }

    let htmlLinks = '<div>';

    // source links if any
    if (an.meta.idHyperlinks && an.meta.idHyperlinks.length > 0) {
      htmlLinks += `
        <a>Source Links <i class="fas fa-external-link-alt ml-1 text-muted"></i></a>
        <div>
      `;

      for (const link of an.meta.idHyperlinks) {
        const {label, url} = JSON.parse(link);
        htmlLinks += `<a target="_blank" href="${escape(toValidLink(url))}">${escape(label)}</a><br>`;
      }

      htmlLinks += `</div></div>`;
    }

    // search links
    const searchLinkCollapseTargetId = uniqueId('pdf-tooltip-collapse-target');
    htmlLinks += `
      <div>
        <div
          class="tooltip-collapse-control collapsed"
          role="button"
          data-toggle="collapse"
          data-target="#${searchLinkCollapseTargetId}"
          aria-expanded="false"
          aria-controls="${searchLinkCollapseTargetId}"
        >Search links <i class="fas fa-external-link-alt ml-1 text-muted"></i></div>
        <div class="collapse" id="${searchLinkCollapseTargetId}">
    `;
    // links should be sorted in the order that they appear in SEARCH_LINKS
    for (const {domain, url} of SEARCH_LINKS) {
      const link = an.meta.links[domain.toLowerCase()] || url.replace(/%s/, encodeURIComponent(an.meta.allText));
      htmlLinks += `<a target="_blank" href="${escape(link)}">${escape(domain.replace('_', ' '))}</a><br>`;
    }
    htmlLinks += `</div></div>`;

    // search internal links
    const searchInternalLinkCollapseTargetId = uniqueId('pdf-tooltip-internal-collapse-target');
    htmlLinks += `
      <div>
        <div
          class="tooltip-collapse-control collapsed"
          role="button"
          data-toggle="collapse"
          data-target="#${searchInternalLinkCollapseTargetId}"
          aria-expanded="false"
          aria-controls="${searchInternalLinkCollapseTargetId}"
        >Search internal links <i class="fas fa-external-link-alt ml-1 text-muted"></i></div>
        <div class="collapse" id="${searchInternalLinkCollapseTargetId}">
    `;
    const visLink = this.internalSearch.getVisualizerLink(an.meta.allText);
    htmlLinks += `<a target="_blank" href="${visLink}">Knowledge Graph</a><br>`;
    const contLink = this.internalSearch.getFileContentLink(an.meta.allText);
    htmlLinks += `<a target="_blank" href="${contLink}">File Content</a><br>`;
    const mapLink = this.internalSearch.getFileContentLink(an.meta.allText, {types: ['map']});
    htmlLinks += `<a target="_blank" href="${mapLink}">Map Content</a><br>`;
    htmlLinks += `</div></div>`;

    base.push(htmlLinks);
    base = [base.join('<br>')];

    if (an.meta.isCustom) {
      base.push(`
        <div class="mt-1">
          <button
            type="button"
            class="btn btn-primary btn-block"
            onclick="
                window.pdfViewerRef['${this.pdfViewerId}']
                  .removeCustomAnnotation(${escape(
        JSON.stringify(an.uuid),
      )})
             ">
            <i class="fas fa-fw fa-trash"></i>
            <span>Delete Annotation</span>
          </button>
        </div>
      `);
    }
    if (!an.meta.isCustom && !an.meta.isExcluded) {
      const annExclusion = {
        id: an.meta.id,
        idHyperlinks: an.meta.idHyperlinks,
        text: an.textInDocument,
        type: an.meta.type,
        rects: an.rects,
        pageNumber: an.pageNumber,
      };
      base.push(`
        <div class="mt-1">
          <button type="button" class="btn btn-primary btn-block" onclick="window.pdfViewerRef['${this.pdfViewerId}'].openExclusionPanel(${escape(
        JSON.stringify(annExclusion))})">
            <i class="fas fa-fw fa-minus-circle"></i>
            <span>Mark for Exclusion</span>
          </button>
        </div>
      `);
    }
    base.push(`
        <div class="mt-1">
          <button type="button" class="btn btn-secondary btn-block" onclick="window.pdfViewerRef['${this.pdfViewerId}'].highlightAllAnnotations(${escape(
      JSON.stringify(an.meta.id))}, false);jQuery('.system-annotation').qtip('hide')">
            <i class="fas fa-fw fa-search"></i>
            <span>Find Occurrences</span>
          </button>
        </div>
      `);
    if (an.meta.isExcluded) {
      const annExclusion = {
        text: an.textInDocument,
        type: an.meta.type,
      };
      base.push(`
        <div class="mt-2">
          <div style="display: flex; flex-direction: column">
            <span style="line-height: 16px">Manually excluded</span>
            <span style="line-height: 16px"><i>reason: </i>${escape(an.meta.exclusionReason)}</span>
            ${an.meta.exclusionComment ? `<span style="line-height: 16px"><i>comment: </i>${escape(an.meta.exclusionComment)}</span>` : ''}
          </div>
          <div class="mt-1">
            <button type="button" class="btn btn-primary btn-block" onclick="window.pdfViewerRef['${this.pdfViewerId}'].removeAnnotationExclusion(${escape(
        JSON.stringify(annExclusion))})">
              <i class="fas fa-fw fa-undo"></i>
              <span>Unmark Exclusion</span>
            </button>
          </div>
        </div>`);
    }
    return base.join('');
  }

  processAnnotations(pageNum: number, pdfPageView: any) {
    this.pageRef[pageNum] = pdfPageView;
    const filteredAnnotations = this.annotations.filter((an) => an.pageNumber === pageNum);
    for (const an of filteredAnnotations) {
      this.addAnnotation(an, pageNum);
    }
  }

  private _focusedTextLayer;
  private set focusedTextLayer(textLayer) {
    if (textLayer) {
      textLayer.style.zIndex = 100;
      this._focusedTextLayer = textLayer;
    } else {
      if (this._focusedTextLayer) {
        this._focusedTextLayer.style.zIndex = null;
      }
      this._focusedTextLayer = undefined;
    }
  };

  private get focusedTextLayer() {
    return this._focusedTextLayer;
  };

  @HostListener('window:mousedown', ['$event'])
  mouseDown(event: MouseEvent) {
    let target = event.target as any;
    let parent = this.getClosestTextLayer(target);
    if (parent) {
      this.focusedTextLayer = parent;
      // coming from pdf-viewer
      // prepare it for drag and drop
      this.dragAndDropOriginCoord = {
        pageX: event.pageX,
        pageY: event.pageY,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      this.dragAndDropOriginHoverCount = jQuery('.textLayer > span:hover').length || 0;
    }
  }

  @HostListener('window:mouseup', ['$event'])
  mouseUp(event) {
    this.focusedTextLayer = null;
    if (this.selecting) {
      this.selecting = false;
      this.selectionEnd(event);
    }
  }

  selection;
  selectionWrapper;

  ranges;

  annotationToolbarPortal = new ComponentPortal(AnnotationToolbarComponent);
  annotationToolbarRef;
  /**
   * Flag used to distinguish deselection and selection end
   * based on selectionchange and mouseup events
   */
  selecting = false;
  usedTextLayerPortalOutlet;

  detachFromUsedTextLayerPortalOutlet() {
    if (this.usedTextLayerPortalOutlet && this.usedTextLayerPortalOutlet.hasAttached()) {
      this.usedTextLayerPortalOutlet.detach();
    }
  }

  @HostListener('document:selectstart', ['$event'])
  selectstart(event: Event) {
    this.deselect();
    this.selection = null;
    this.firstAnnotationRange = null;
    // taking parent as to not start with Text node which does not have 'closest' method
    let pageNumber = this.getClosestPageNumber(event.target as Node);
    // not selecting outside pdf viewer
    if (pageNumber > -1) {
      this.selecting = true;
      const textLayerPortalOutlet = this.textLayerPortalOutlets.get(pageNumber);
      this.usedTextLayerPortalOutlet = textLayerPortalOutlet;
      this.annotationToolbarRef = textLayerPortalOutlet.attach(this.annotationToolbarPortal);
      this.annotationToolbarRef.instance.pageRef = this.pageRef;
      this.annotationToolbarRef.instance.containerRef = this.containerRef;
      this.annotationToolbarRef.instance.annotationCreated.subscribe(val => {
        this.annotationCreated.next(val);
      });
    }
  }

  deselect() {
    if (IS_MAC) {
      this.removeSelectionDragContainer();
    }
    this.detachFromUsedTextLayerPortalOutlet();
  }

  removeSelectionDragContainer() {
    if (this.selectionDragContainer) {
      this.selectionDragContainer.remove();
      this.selectionDragContainer = undefined;
    }
  }

  @HostListener('document:selectionchange', ['$event'])
  selectionChange(event: Event) {
    if(this.selecting) {
      const selection = window.getSelection();
      const ranges = this.getValidSelectionRanges(selection);
      if (ranges.length) {
        this.selection = selection;
        this.ranges = ranges;
        this.firstAnnotationRange = ranges[0];
        this.placeAnnotationToolbar(ranges[0]);
      } else {
        this.selection = null;
        this.firstAnnotationRange = null;
      }
    } else {
      this.deselect();
    }
  }

  /**
   * Clone elements and reposition them to match originals
   * @param range
   */
  cloneRangeContents(range: Range) {
    const {startOffset, endOffset} = range;
    let rangeDocumentFragment = range.cloneContents();
    // if selection is within singular span and not empty
    if (!rangeDocumentFragment.children.length && !range.collapsed) {
      const clonedElement = range.commonAncestorContainer.parentElement.cloneNode(true) as HTMLElement;
      clonedElement.innerText = clonedElement.innerText.slice(startOffset, endOffset);
      rangeDocumentFragment.appendChild(clonedElement);
    }
    // drop padding and reposition accordingly
    forEach(rangeDocumentFragment.children, (node: HTMLElement) => {
      // scrap translate transformations which balances padding misplacement
      node.style.transform = node.style.transform.replace(/ ?translate.{0,2}\(.*?\)/gi, '');
    });
    // adjust first container position if contains fraction of text
    if (startOffset) {
      const firstClonedElement = rangeDocumentFragment.firstElementChild as HTMLElement;
      if (firstClonedElement) {
        // estimation based on percentage of ignored letters
        const offsetOfStart = startOffset / firstClonedElement.innerText.length;
        firstClonedElement.style.transform += ` translateX(${offsetOfStart * 100}%)`;
      }
    }
    return rangeDocumentFragment;
  }

  selectionDragContainer;

  /** Implement natively missing selection end event
   *  Although it does not exist in Selection API it
   *  can be easily added to fire on first mouseup
   *  after selection start.
   */
  selectionEnd(event: Event) {
    if(this.firstAnnotationRange) {
      if (IS_MAC) {
        const textLayer = this.getClosestTextLayer(this.firstAnnotationRange.commonAncestorContainer);
        // if it is not multiple page selection (not-supported - still would work just without behaviour adjustment for mac)
        if (textLayer) {
          this.removeSelectionDragContainer();
          // Create transparent not selectable overlay with copy of selected nodes
          const drag = document.createElement('div');
          drag.draggable = true;
          drag.classList.add('selection');
          drag.appendChild(this.cloneRangeContents(this.firstAnnotationRange));
          textLayer.appendChild(drag);
          this.selectionDragContainer = drag;
        }
      }
    } else {
      this.deselect();
    }
    // allow interaction with toolbar after selection to prevent flickering
    this.annotationToolbarRef.instance.active = true;
  }

  /**
   * Wrapper on event.dataTransfer.setDragImage to adjust drag image styling
   * @param node - to use as drag image
   * @param event - event to decorate
   */
  setDragImage(node, event) {
    let draggedElementRef = IS_MAC ? this.selectionDragContainer :
      this.getClosestTextLayer(this.firstAnnotationRange.commonAncestorContainer);

    draggedElementRef.classList.add('dragged');
    // event.dataTransfer.setDragImage runs in async after dragstart but does not return the handle
    // styling needs to be reversed after current async stack is emptied
    defer(() => draggedElementRef.classList.remove('dragged'));
  }

  @HostListener('dragstart', ['$event'])
  dragStart(event: DragEvent) {
    const {selection, ranges} = this;
    this.setDragImage(this.selectionDragContainer, event);
    const currentPage = this.detectPageFromRanges(ranges);
    if (ranges.length && currentPage != null) {
      this.annotationDragStart.emit({
        event,
        meta: {
          allText: selection.toString(),
          type: 'link',
        },
        location: {
          pageNumber: currentPage,
          rect: this.toPDFRelativeRects(currentPage, ranges.map(range => range.getBoundingClientRect()))[0],
        },
      });

      event.stopPropagation();
    }
  }

  @HostListener('dragend', ['$event'])
  dragEnd(event: DragEvent) {
    let page = this.getClosestTextLayer(this.firstAnnotationRange.commonAncestorContainer);
    page.classList.remove('dragged');
  }

  //endregion

  deleteFrictionless() {
    const annotationRef = jQuery('.frictionless-annotation');
    annotationRef.qtip('destroy');
    annotationRef.remove();
  }

  resetSelection() {
    this.selectedText = [];
    this.selectedTextCoords = [];
    this.allText = '';
    this.selectedElements = [];
  }

  openAnnotationPanel() {
    const text = window.getSelection().toString().trim();
    const selection = window.getSelection();
    const ranges = this.getValidSelectionRanges(selection);
    const currentPage = this.detectPageFromRanges(ranges);

    if (ranges.length && currentPage != null) {
      const dialogRef = openModal(this.modalService, AnnotationEditDialogComponent);
      dialogRef.componentInstance.allText = text;
      dialogRef.componentInstance.keywords = [text];
      dialogRef.componentInstance.coords = this.toPDFRelativeRects(currentPage, ranges.map(range => range.getBoundingClientRect()));
      dialogRef.componentInstance.pageNumber = currentPage;
      dialogRef.result.then(annotation => {
        this.annotationCreated.emit(annotation);
        window.getSelection().empty();
      }, () => {
      });
    } else {
      this.errorHandler.showError(new Error('openAnnotationPanel(): failed to get selection or page on PDF viewer'));
    }
  }

  /**
   * Get a list of valid selections within the text.
   *
   * @param selection the selection to parse
   */
  private getValidSelectionRanges(selection: Selection): Range[] {
    const ranges: Range[] = [];
    const container = this.elementRef.nativeElement;
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      if (!range.collapsed && (container.contains(range.startContainer) || container.contains(range.endContainer))) {
        ranges.push(range);
      }
    }
    return ranges;
  }

  /** Get the closest DOM element by selector
   * This helper method allows for search starting on Node
   * not only on Element (extending Element.closest() capabilities)
   * @param node
   * @param selector
   */
  getClosest(node: Node, selector: string) {
    // fail fast - don't search outside of view
    if (!node || node === this.elementRef.nativeElement) {
      return null;
    }
    if (node instanceof Element) {
      return node.closest(selector);
    }
    // if there is no parent `parentElement` will return null
    // if we use `parentNode` here it can cause infinite loop
    // for instance on node = document
    return this.getClosest(node.parentElement, selector);
  }

  /**
   * Helper to have mapping by '.page' declared only once
   * @param node
   */
  getClosestPage(node: Node) {
    return this.getClosest(node, '.page');
  }

  /**
   * Helper to have mapping by '.page' declared only once
   * @param node
   */
  getClosestPageNumber(node: Node): number {
    const page = this.getClosestPage(node);
    const pageView = Object.entries(this.pageRef).find(([pageNumber, p]) => p.div === page);
    return pageView ? parseInt(pageView[0]) : -1;
  }

  /**
   * Helper to have mapping by '.textLayer' declared only once
   * @param node
   */
  getClosestTextLayer(node: Node) {
    return this.getClosest(node, '.textLayer');
  }

  /**
   * Position the annotation toolbar.
   */
  private placeAnnotationToolbar(range: Range) {
    if (range != null) {
      const rangeRects = range.getClientRects();
      if (rangeRects.length) {
        const page = this.getClosestPage(range.startContainer);
        const containerRect = page.getBoundingClientRect();
        const rect = rangeRects.item(0);
        this.annotationToolbarRef.instance.position = {
          left: rect.left - containerRect.left,
          top: rect.top - containerRect.top
        };
      }
    }
  }

  isSelectionAnnotatable(): boolean {
    const text = window.getSelection().toString();
    return text.trim() != '';
  }

  copySelectionText() {
    navigator.clipboard.writeText(window.getSelection().toString()).then(() => {
      this.snackBar.open('Copied text to clipboard.', null, {
        duration: 2000,
      });
    }, () => {
      this.snackBar.open('Failed to copy text.', null, {
        duration: 2000,
      });
    });
  }

  openExclusionPanel(annExclusion) {
    jQuery('.system-annotation').qtip('hide');

    const dialogRef = this.modalService.open(AnnotationExcludeDialogComponent);
    dialogRef.componentInstance.text = annExclusion.text;
    dialogRef.componentInstance.type = annExclusion.type;
    dialogRef.result.then(exclusionData => {
      this.annotationExclusionAdded.emit({...exclusionData, ...annExclusion});
    }, () => {
    });
  }

  removeAnnotationExclusion(annExclusion) {
    jQuery('.system-annotation').qtip('hide');
    this.annotationExclusionRemoved.emit(annExclusion);
  }

  clearSelection() {
    const sel = window.getSelection();
    sel.removeAllRanges();
  }

  /**
   * Set custom path to pdf worker
   */
  setCustomWorkerPath() {
    (window as any).pdfWorkerSrc = '/lib/pdfjs-dist/legacy/build/pdf.worker.js';
  }

  incrementPage(amount: number) {
    this.page += amount;
  }

  incrementZoom(amount: number) {
    this.zoom += amount;
  }

  setZoom(amount: number) {
    this.zoom = amount;
  }

  rotate(angle: number) {
    this.rotation += angle;
  }

  /**
   * Render PDF preview on selecting file
   */
  onFileSelected() {
    const $pdf: any = document.querySelector('#file');

    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        this.pdfSrc = e.target.result;
      };

      reader.readAsArrayBuffer($pdf.files[0]);
    }
  }

  /**
   * Get pdf information after it's loaded
   */
  afterLoadComplete(pdf: PDFDocumentProxy) {
    this.pdf = pdf;

    this.loadOutline();

    this.isLoadCompleted = true;

    this.loadCompleted.emit(true);
  }

  /**
   * Get outline
   */
  loadOutline() {
    this.pdf.getOutline().then((outline: any[]) => {
      this.outline = outline;
    });
  }

  /**
   * Handle error callback
   */
  onError(error: any) {
    this.error = error; // set error
    console.log(error);
  }

  /**
   * Pdf loading progress callback
   */
  onProgress(progressData: PDFProgressData) {
    this.progressData = progressData;

    this.isLoaded = progressData.loaded >= progressData.total;
    this.isLoadCompleted = !!this.isLoaded;
    this.error = null; // clear error
  }

  getInt(value: number): number {
    return Math.round(value);
  }

  /**
   * Scroll view
   */
  scrollToPage(pageNum: number, highlightRect?: number[]) {
    const dest = {pageNumber: pageNum} as ScrollDestination;
    if (highlightRect.length >= 2) {
      dest.destArray = [
        null,
        {name: 'XYZ'},
        highlightRect[0],
        highlightRect[1],
        null
      ];
    }
    this.pdfComponent.pdfViewer.scrollPageIntoView(dest);
  }

  highlightAllAnnotations(id: string | undefined, toggle = true) {
    if (toggle && id != null) {
      if (this.currentHighlightAnnotationId === id) {
        id = null;
      }
    }

    this.currentHighlightAnnotationId = id;
    const foundHighlightAnnotations = [];

    let firstPageNumber = null;
    let firstAnnotation: Annotation = null;

    for (const annotation of this.annotations) {
      if (annotation.meta.id === id) {
        foundHighlightAnnotations.push(annotation);
        if (!firstAnnotation) {
          firstAnnotation = annotation;
          firstPageNumber = annotation.pageNumber;
        }
      }
    }

    for (const pageIndex of Object.keys(this.pageRef)) {
      const page = this.pageRef[pageIndex];
      const overlays = (page as any).div.querySelectorAll('.system-annotation');
      for (const overlay of overlays) {
        if (overlay.dataset.annotationId === id) {
          overlay.classList.add('annotation-highlight');
        } else {
          overlay.classList.remove('annotation-highlight');
        }
      }
    }

    this.foundHighlightAnnotations = foundHighlightAnnotations;
    this.currentHighlightAnnotationsIndex = 0;
    this.annotationHighlightChange.emit(id != null ? {
      id,
      firstAnnotation,
      firstPageNumber,
      found: foundHighlightAnnotations.length,
    } : null);

    if (id != null) {
      this.nullifyMatchesCount();
      this.searchQueryChanged({
        keyword: '',
        findPrevious: true,
      });

      if (foundHighlightAnnotations.length) {
        this.snackBar.open(
          `Highlighted ${foundHighlightAnnotations.length} instance${foundHighlightAnnotations.length === 1 ? '' : 's'}  `
          + (firstAnnotation != null ? `of '${firstAnnotation.meta.allText}' ` : '')
          + `in the document, starting on page ${firstPageNumber}.`,
          'Close', {duration: 5000});

        this.addHighlightItem(firstPageNumber, firstAnnotation.rects[0]);
      } else {
        this.snackBar.open(`The annotation could not be found in the document.`,
          'Close', {duration: 5000});
      }
    }
  }

  goToAnnotationHighlight(index) {
    const annotationLength = this.foundHighlightAnnotations.length;
    const normalizedIndex = (annotationLength + index) % annotationLength;
    this.currentHighlightAnnotationsIndex = normalizedIndex;
    const {pageNumber, rects: [rect]} = this.foundHighlightAnnotations[normalizedIndex];
    this.addHighlightItem(pageNumber, rect);
  }

  previousAnnotationHighlight() {
    if (this.currentHighlightAnnotationsIndex != null && this.foundHighlightAnnotations.length) {
      this.goToAnnotationHighlight(this.currentHighlightAnnotationsIndex - 1);
    }
  }

  nextAnnotationHighlight() {
    if (this.currentHighlightAnnotationsIndex != null && this.foundHighlightAnnotations.length) {
      this.goToAnnotationHighlight(this.currentHighlightAnnotationsIndex + 1);
    }
  }

  clearResults() {
    this.highlightAllAnnotations(null);
    this.searchQueryChanged({
      keyword: '',
      findPrevious: true,
    });
  }

  addHighlightItem(pageNum: number, highlightRect: number[]) {
    const pdfPageView = this.pageRef[pageNum];
    if (!pdfPageView) {
      this.pendingHighlights[pageNum] = highlightRect;
      this.scrollToPage(pageNum, highlightRect);
      return;
    }
    const viewPort: PageViewport = pdfPageView.viewport;
    const bounds = viewPort.convertToViewportRectangle(highlightRect);
    const left = Math.min(bounds[0], bounds[2]);
    const top = Math.min(bounds[1], bounds[3]);
    const width = Math.abs(bounds[0] - bounds[2]);
    const height = Math.abs(bounds[1] - bounds[3]);
    const overlayContainer = pdfPageView.div;
    const overlayDiv = document.createElement('div');
    overlayDiv.setAttribute('style', `border: 2px solid red; position:absolute;` +
      'left:' + (left - 4) + 'px;top:' + (top - 4) + 'px;width:' + (width + 8) + 'px;height:' + (height + 8) + 'px;');
    overlayContainer.appendChild(overlayDiv);
    overlayDiv.scrollIntoView({block: 'center'});
    jQuery(overlayDiv).effect('highlight', {}, 1000);
    setTimeout(() => {
      jQuery(overlayDiv).remove();
    }, 3000);
  }

  textLayerPortalOutlets: Map<number, DomPortalOutlet> = new Map();

  createTextLayerPortalOutlet({pageNumber, textLayerDiv}: TextLayerBuilder) {
    const portalOutlet = new DomPortalOutlet(
      textLayerDiv,
      this.cfr,
      this.appRef,
      this.injector
    );
    this.textLayerPortalOutlets.set(pageNumber, portalOutlet);
  }

  /**
   * Page rendered callback, which is called when a page is rendered (called multiple times)
   */
  pageRendered({pageNumber, source}: PDFPageRenderEvent) {
    this.allPages = this.pdf.numPages;
    this.currentRenderedPage = pageNumber;
    this.createTextLayerPortalOutlet(source.textLayer);
    this.processAnnotations(pageNumber, source);
  }

  searchQueryChanged(newQuery: { keyword: string, findPrevious: boolean }) {
    const keyword = newQuery.keyword.trim();
    if (keyword.length) {
      this.highlightAllAnnotations(null);
    }
    this.searchChange.emit(keyword);
    if (newQuery.keyword !== this.pdfQuery) {
      this.pdfQuery = newQuery.keyword;
      this.searchCommand = 'find';
      this.pdfComponent.pdfFindController.executeCommand('find', {
        query: this.pdfQuery,
        highlightAll: true,
        phraseSearch: true,
        findPrevious: newQuery.findPrevious,
      });
    } else {
      this.searchCommand = 'findagain';
      this.pdfComponent.pdfFindController.executeCommand('findagain', {
        query: this.pdfQuery,
        highlightAll: true,
        phraseSearch: true,
        findPrevious: newQuery.findPrevious,
      });
    }
  }

  @HostListener('keydown.control.c')
  @HostListener('keydown.meta.c')
  copySelectedText() {
    let listener = (e: ClipboardEvent) => {
      let clipboard = e.clipboardData || window['clipboardData'];
      clipboard.setData('text', this.allText);
      e.preventDefault();
    };

    document.addEventListener('copy', listener, false);
    document.execCommand('copy');
    document.removeEventListener('copy', listener, false);

    this.deleteFrictionless();

    this.snackBar.open('It has been copied to clipboard', 'Close', {duration: 5000});

  }

  removeCustomAnnotation(uuid) {
    jQuery('.system-annotation').qtip('hide');
    this.annotationRemoved.emit(uuid);
  }

  termsMatch(termInExclusion, termInAnnotation, isCaseInsensitive) {
    if (isCaseInsensitive) {
      return termInExclusion.toLowerCase() === termInAnnotation.toLowerCase();
    }
    return termInExclusion === termInAnnotation;
  }

  markAnnotationExclusions(exclusionData: AddedAnnotationExclusion) {
    this.annotations.forEach((ann: Annotation) => {
      if (ann.meta.type === exclusionData.type &&
        this.termsMatch(exclusionData.text, ann.textInDocument, exclusionData.isCaseInsensitive)) {
        const ref = this.annotationHighlightElementMap.get(ann);
        jQuery(ref).remove();
        ann.meta.isExcluded = true;
        ann.meta.exclusionReason = exclusionData.reason;
        ann.meta.exclusionComment = exclusionData.comment;
        ann.meta.isCaseInsensitive = exclusionData.isCaseInsensitive;
        this.addAnnotation(ann, ann.pageNumber);
      }
    });
    this.renderFilterSettings();
  }

  unmarkAnnotationExclusions(exclusionData: RemovedAnnotationExclusion) {
    this.annotations.forEach((ann: Annotation) => {
      if (ann.meta.type === exclusionData.type && this.termsMatch(exclusionData.text, ann.textInDocument, ann.meta.isCaseInsensitive)) {
        const ref = this.annotationHighlightElementMap.get(ann);
        jQuery(ref).remove();
        ann.meta.isExcluded = false;
        this.addAnnotation(ann, ann.pageNumber);
      }
    });
    this.renderFilterSettings();
  }

  @Output('matches-count-updated') matchesCountUpdated = new EventEmitter<any>();

  findControlStateUpdated(event) {
    if (this.goToPositionVisitAfterFind != null) {
      this.goToPositionVisit.emit(this.goToPositionVisitAfterFind);
      this.goToPositionVisitAfterFind = null;
    }
    if (this.showNextFindFeedback) {
      if (event.state === FindState.FOUND) {
        this.showNextFindFeedback = false;
        this.snackBar.open('Found the text in the document.', 'Close', {duration: 5000});
      } else if (event.state === FindState.NOT_FOUND) {
        this.showNextFindFeedback = false;
        this.snackBar.open('Could not find the text in the document.', 'Close', {duration: 5000});
      }
    }
    if (this.searchCommand !== 'findagain' || typeof event.previous === 'undefined') {
      return;
    }
    this.matchesCount = event.matchesCount;
  }

  nullifyMatchesCount() {
    this.matchesCount.total = 0;
    this.matchesCount.current = 0;
  }

  getMultilinedRect() {
    // Find min value for bottom left point and max value for top right point
    // to save the coordinates of the rect that represents multiple lines
    return this.selectedTextCoords.reduce((result, rect) => {
      result[0] = Math.min(result[0], rect[0]);
      result[1] = Math.max(result[1], rect[1]);
      result[2] = Math.max(result[2], rect[2]);
      result[3] = Math.min(result[3], rect[3]);
      return result;
    }, [Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE, Number.MAX_VALUE]);
  }

  private detectPageFromRanges(ranges: Range[]): number | undefined {
    for (const range of ranges) {
      const element: Node = range.commonAncestorContainer;
      const pageElement = this.getClosestPage(element);
      if (pageElement) {
        return parseInt(pageElement.getAttribute('data-page-number'), 10);
      }
    }
    return null;
  }

  private toPDFRelativeRects(pageNumber: number, rects: (ClientRect | DOMRect)[]): Rect[] {
    const pdfPageView = this.pageRef[pageNumber];
    const viewport = pdfPageView.viewport;
    const pageRect = pdfPageView.canvas.getClientRects()[0];
    const ret: Rect[] = [];
    for (const r of rects) {
      ret.push(viewport.convertToPdfPoint(r.left - pageRect.left, r.top - pageRect.top)
        .concat(viewport.convertToPdfPoint(r.right - pageRect.left, r.bottom - pageRect.top)));
    }
    return ret;
  }
}

export interface AnnotationHighlightResult {
  id: string;
  firstAnnotation: Annotation;
  firstPageNumber: number;
  found: number;
}

export interface AnnotationDragEvent {
  event: DragEvent;
  meta: Meta;
  location: Location;
}
