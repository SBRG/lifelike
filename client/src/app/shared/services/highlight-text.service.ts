import { Injectable, InjectionToken, Injector } from '@angular/core';

import { escape } from 'lodash-es';
import { Subscription } from 'rxjs';

export const HIGHLIGHT_TEXT_TAG_HANDLER = new InjectionToken<TagHandler[]>('highlightTextTagHandler');

@Injectable()
export class HighlightTextService {
  protected _tagHandlers: Map<string, TagHandler> | undefined;

  constructor(protected readonly injector: Injector) {
  }

  get tagHandlers(): Map<string, TagHandler> {
    const tagHandlers = this._tagHandlers;
    if (tagHandlers != null) {
      return tagHandlers;
    }
    this.reload();
    return this._tagHandlers;
  }

  reload() {
    const tagHandlers = new Map<string, TagHandler>();
    for (const tagHandler of this.injector.get(HIGHLIGHT_TEXT_TAG_HANDLER)) {
      tagHandlers.set(tagHandler.tagName, tagHandler);
    }
    this._tagHandlers = tagHandlers;
  }

  generateHTML(s: string) {
    const parser = new DOMParser();
    return this.generateHTMLFromNode(
      parser.parseFromString(s, 'application/xml').documentElement,
    );
  }

  addEventListeners(element: Element, detail: { [key: string]: any } = {}): Subscription {
    const listenerArgs: [string, EventListenerOrEventListenerObject][] = [];

    for (const eventName of ['dragStart', 'mouseDown', 'click']) {
      listenerArgs.push([
        eventName.toLowerCase(),
        (event: Event) => {
          for (const tagHandler of this.tagHandlers.values()) {
            tagHandler[eventName](event, detail);
          }
        },
      ]);
    }

    for (const args of listenerArgs) {
      element.addEventListener(...args);
    }

    const subscription = new Subscription();
    subscription.add(() => {
      for (const args of listenerArgs) {
        element.removeEventListener(...args);
      }
    });

    return subscription;
  }

  private generateHTMLFromNode(node: Node) {
    // WARNING: Watch out for XSS vulns!
    if (node.nodeType === Node.TEXT_NODE || node.nodeType === Node.CDATA_SECTION_NODE) {
      return escape(node.nodeValue);
    } else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_NODE) {
      let html = '';
      const tagHandler = this.tagHandlers.get(node.nodeName);
      if (tagHandler != null) {
        html += tagHandler.start(node as Element);
      }
      for (let child = node.firstChild; child; child = child.nextSibling) {
        html += this.generateHTMLFromNode(child);
      }
      if (tagHandler != null) {
        html += tagHandler.end(node as Element);
      }
      return html;
    } else {
      return '';
    }
  }
}

export abstract class TagHandler {
  abstract get tagName(): string;

  abstract start(element: Element): string;

  abstract end(element: Element): string;

  dragStart(event: DragEvent, detail: { [key: string]: any }) {
  }

  mouseDown(event: MouseEvent, detail: { [key: string]: any }) {
  }

  click(event: MouseEvent, detail: { [key: string]: any }) {
  }
}

