import { Component, Input, ViewEncapsulation, SimpleChanges, OnChanges, OnDestroy } from '@angular/core';

import { SEARCH_LINKS } from 'app/shared/links';

import { Annotation } from '../bioc.format';

@Component({
  selector: 'app-bioc-annotated-text',
  templateUrl: './annotated-text.component.html',
  encapsulation: ViewEncapsulation.None,
  styleUrls: ['./annotated-text.component.scss'],
})
export class AnnotatedTextComponent implements OnChanges, OnDestroy {
  @Input() text;
  @Input() annotations: Annotation[];
  @Input() offset;
  @Input() position: string|number;

  parts: (string | Annotation)[];

  private txt;

  constructor() {
    this.txt = document.createElement('textarea');
  }

  decodeHTML(html) {
    // this.txt.innerHTML = html;
    // return this.txt.value;
    // return html.replace(/&[A-z0-9]{2,5};/g, ' ');
    return html;
  }

  ngOnDestroy() {
    const parent = this.txt.parentNode;
    if (parent) {
      parent.removeChild(this.txt);
    }
  }

  getSource(payload: any = {}) {
    const identifier = payload.identifier || payload.Identifier;
    const type = payload.type;
    // console.log(payload);
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

  dragStarted($event) {
    console.log('Drag started in annotated text');
  }

  ngOnChanges(changes: SimpleChanges) {
    // todo: nested annotations are allowed but not implemented
    const globalOffset = this.offset || 0;
    const decodedText = this.decodeHTML(this.text);
    this.parts = this.annotations.reduce((acc, annotation) => {
      return annotation.locations.reduce((iacc, location) => {
        let part;
        let offset = 0;
        let idx = 0;
        for (idx = 0; idx < iacc.length; idx++) {
          part = iacc[idx];
          const localOffset = part.location ? part.location.length : part.length;
          if (offset + localOffset + globalOffset >= location.offset) {
            if (offset + globalOffset > location.offset || part.location) {
              return iacc;
            }
            break;
          }
          if (part.location) {
            // if possible use absolute offset to not propagate potential error
            offset = part.location.offset + part.location.length - globalOffset;
          } else {
            offset += localOffset;
          }
        }
        offset += globalOffset;
        const startOffset = -offset + location.offset;
        const endOffset = -offset + location.offset + location.length;
        const rawText = part.slice(startOffset, endOffset);
        if (rawText.length < location.length) {
          console.error('Ran out of index!', part, location, offset);
          return iacc;
        }
        if (part.slice(startOffset, endOffset) !== annotation.text) {
          for (let i = 0; i < part.length; i++) {
            if (part.slice(startOffset - i, endOffset - i) === annotation.text) {
              break;
            }
            if (part.slice(startOffset + i, endOffset + i) === annotation.text) {
              break;
            }
          }
          return iacc;
        }
        return iacc
          .slice(0, idx)
          .concat([
            part.slice(0, startOffset),
            { ...annotation, location },
            part.slice(endOffset)
          ])
          .concat(iacc.slice(idx + 1));
      }, acc);
    }, [decodedText]);
  }
}
