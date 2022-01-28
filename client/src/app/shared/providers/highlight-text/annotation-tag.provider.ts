import { Injectable, RendererFactory2 } from '@angular/core';

import { escape, uniqueId } from 'lodash-es';
import Color from 'color';

import { DatabaseLink, EntityType, ENTITY_TYPE_MAP } from 'app/shared/annotation-types';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import {
  Hyperlink,
  Reference,
  Source,
  UniversalGraphNode,
  UniversalGraphNodeTemplate,
} from 'app/drawing-tool/services/interfaces';
import { createNodeDragImage } from 'app/drawing-tool/utils/drag';
import { Meta } from 'app/pdf-viewer/annotation-type';

import { DropdownController } from '../../utils/dom/dropdown-controller';
import { GenericDataProvider } from '../data-transfer-data/generic-data.provider';
import { isCtrlOrMetaPressed } from '../../utils';
import { SEARCH_LINKS } from '../../links';
import { annotationTypesMap } from '../../annotation-styles';
import { TagHandler } from '../../services/highlight-text.service';

@Injectable()
export class AnnotationTagHandler extends TagHandler {
  tagName = 'annotation';
  popoverElement: HTMLElement;
  dropdownController: DropdownController;

  constructor(protected readonly rendererFactory2: RendererFactory2) {
    super();
    const renderer = rendererFactory2.createRenderer(document.body, null);
    this.popoverElement = this.createPopoverElement();
    this.dropdownController = new DropdownController(renderer, document.body, this.popoverElement, {
      fixedAnchorPoint: true,
    });

    // Janky - move to new PopoverController or something later
    document.body.addEventListener('click', event => {
      this.popoverElement.style.display = 'none';
      this.dropdownController.close();
    });
  }

  private createPopoverElement() {
    // Janky - move to new PopoverController or something later and/or switch to Popper.js
    const container = document.createElement('div');
    container.className = 'popover';
    container.style.display = 'none';
    container.style.overflow = 'auto';
    container.style.width = '200px';
    container.addEventListener('click', event => event.stopPropagation());

    const header = document.createElement('h3');
    header.className = 'popover-header';
    container.appendChild(header);

    const body = document.createElement('div');
    body.className = 'popover-body';
    container.appendChild(body);

    document.body.appendChild(container);
    return container;
  }

  start(element: Element): string {
    return `<span data-annotation-meta="${escape(element.getAttribute('meta'))}"` +
      ` style="background: ${this.toAnnotationBackgroundColor(this.getAnnotationColor(element))}">`;
  }

  end(element: Element): string {
    return `</span>`;
  }

  dragStart(event: DragEvent, detail: { [key: string]: any }) {
    const [element, meta] = this.getElementFromEvent(event);
    const object: FilesystemObject | undefined = detail.object;

    if (element != null) {
      let search;
      let text = element.textContent;

      const sources: Source[] = [];
      const references: Reference[] = [];
      const hyperlinks: Hyperlink[] = [];

      if (object != null) {
        sources.push(...object.getGraphEntitySources(meta));
      }

      search = Object.keys(meta.links || []).map(k => {
        return {
          domain: k,
          url: meta.links[k],
        };
      });

      if (meta.allText != null) {
        text = meta.allText;
      }

      const hyperlink = meta.idHyperlinks || [];

      text = meta.type === 'Link' ? 'Link' : text;

      for (const link of hyperlink) {
        const {label, url} = JSON.parse(link);
        hyperlinks.push({
          domain: label,
          url,
        });

        references.push({
          type: 'DATABASE',
          id: url,
        });
      }

      const copiedNode: UniversalGraphNodeTemplate = {
        display_name: text,
        label: meta.type.toLowerCase(),
        sub_labels: [],
        data: {
          sources,
          search,
          references,
          hyperlinks,
          detail: meta.type === 'Link' ? text : '',
        },
        style: {
          showDetail: meta.type === 'Link',
        },
      };

      const dragImageNode: UniversalGraphNode = {
        ...copiedNode,
        hash: '',
        data: {
          ...copiedNode.data,
          x: 0,
          y: 0,
        },
      };

      const dataTransfer: DataTransfer = event.dataTransfer;
      createNodeDragImage(dragImageNode).addDataTransferData(dataTransfer);
      dataTransfer.setData('text/plain', text);
      dataTransfer.setData('application/lifelike-node', JSON.stringify(copiedNode));
      if (object) {
        GenericDataProvider.setURIs(dataTransfer, [{
          title: object.filename,
          uri: new URL(object.getURL(false), window.location.href).href,
        }]);
      }

      this.selectText(element);

      event.stopPropagation();
    }
  }

  mouseDown(event: MouseEvent, detail: { [key: string]: any }) {
    if (isCtrlOrMetaPressed(event)) {
      const [element, meta] = this.getElementFromEvent(event);

      if (element != null) {
        this.selectText(element);
        event.stopPropagation();
      }
    }
  }

  click(event: MouseEvent, detail: { [key: string]: any }) {
    const [element, meta] = this.getElementFromEvent(event);

    if (element != null) {
      // Janky - move to new PopoverController or something later
      this.popoverElement.getElementsByClassName('popover-header')[0].innerHTML = escape(element.textContent);
      this.popoverElement.getElementsByClassName('popover-body')[0].innerHTML = this.prepareTooltipContent(meta);
      this.popoverElement.style.display = 'block';

      this.dropdownController.openRelative(element, {
        maxWidth: 200,
        placement: 'bottom-left',
      });

      event.stopPropagation();
    }
  }

  private selectText(element: Element) {
    const range = document.createRange();
    range.selectNode(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }

  private prepareTooltipContent(meta: Meta): string {
    // Copied from pdf-viewer-lib.component.ts :(
    // TODO: Move somewhere else
    let base = [`Type: ${meta.type}`];
    let idLink: DatabaseLink = null;
    const annoId = meta.id.indexOf(':') !== -1 ? meta.id.split(':')[1] : meta.id;

    if (ENTITY_TYPE_MAP.hasOwnProperty(meta.type)) {
      const source = ENTITY_TYPE_MAP[meta.type] as EntityType;
      idLink = source.links.filter(link => link.name === meta.idType)[0];
    }

    if (idLink !== null) {
      // tslint:disable-next-line:max-line-length
      base.push(annoId && annoId.indexOf('NULL') === -1 ? `Id: <a href=${escape(`${idLink.url}${annoId}`)} target="_blank">${escape(annoId)}</a>` : 'Id: None');
    } else {
      base.push(annoId && annoId.indexOf('NULL') === -1 ? `Id: ${escape(annoId)}` : 'Id: None');
    }

    if (meta.idType) {
      base.push(`Data Source: ${escape(meta.idType)}`);
    }
    if (meta.isCustom) {
      base.push(`User generated annotation`);
    }

    let htmlLinks = '<div>';

    // source links if any
    if (meta.idHyperlinks && meta.idHyperlinks.length > 0) {
      htmlLinks += `
        <div>Source Links <i class="fas fa-external-link-alt ml-1 text-muted"></i></div>
        <div>
      `;

      for (const link of meta.idHyperlinks) {
          const {label, url} = JSON.parse(link);
          htmlLinks += `<a target="_blank" href="${escape(url)}">${escape(label)}</a><br>`;
      }

      htmlLinks += `</div></div>`;
    }

    // search links
    // TODO: collapsing doesn't work here
    // need to play around with the stopPropagation
    const searchLinkCollapseTargetId = uniqueId('enrichment-tooltip-collapse-target');
    htmlLinks += `
      <div>
        <div>Search links <i class="fas fa-external-link-alt ml-1 text-muted"></i></div>
        <div>
    `;
    // links should be sorted in the order that they appear in SEARCH_LINKS
    for (const {domain, url} of SEARCH_LINKS) {
      const link = meta.links[domain.toLowerCase()] || url.replace(/%s/, encodeURIComponent(meta.allText));
      htmlLinks += `<a target="_blank" href="${escape(link)}">${escape(domain.replace('_', ' '))}</a><br>`;
    }
    htmlLinks += `</div></div>`;

    base.push(htmlLinks);
    base = [base.join('<br>')];
    return base.join('');
  }

  private getElementFromEvent(event: Event): [HTMLElement, Meta] {
    let expectedSpan = event.target;

    while (expectedSpan != null) {
      if (expectedSpan instanceof Element) {
        const targetElement = expectedSpan as Element;
        if (targetElement.getAttribute('data-annotation-meta')) {
          break;
        } else {
          expectedSpan = targetElement.parentNode;
        }
      } else if (expectedSpan instanceof Node) {
        expectedSpan = (expectedSpan as Node).parentNode;
      } else {
        expectedSpan = null;
      }
    }

    if (expectedSpan != null) {
      const element: HTMLElement = expectedSpan as HTMLElement;
      const metaData: string = element.getAttribute('data-annotation-meta');

      if (metaData) {
        const meta: Meta = JSON.parse(metaData);
        return [element, meta];
      }
    }

    return [null, null];
  }

  private getAnnotationColor(element: Element) {
    const typeId = element.getAttribute('type').toLowerCase();
    const type = annotationTypesMap.get(typeId);
    if (type != null) {
      return type.color;
    } else {
      return '#efefef';
    }
  }

  private toAnnotationBackgroundColor(color) {
    const colorObj = Color(color);
    const rgb = colorObj.object();
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
  }
}
