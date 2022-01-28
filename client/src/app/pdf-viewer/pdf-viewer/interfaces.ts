import { RenderTextMode } from '../utils/constants';

export interface PDFProgressData {
  loaded: number;
  total: number;
}

export type PDFSource =
  string |
  Uint8Array |
  { data: Uint8Array } |
  { url: string };

export interface PDFViewerParams {
  eventBus: any;
  container: Node;
  removePageBorders: boolean;
  linkService: any;
  textLayerMode: RenderTextMode;
  findController: any;
}

// Based on https://github.com/mozilla/pdf.js/search?q=scrollPageIntoView and
// https://github.com/mozilla/pdf.js/blob/f07d50f8eeced1cd9cc967e938485893d584fc32/web/base_viewer.js#L900:L909
export interface ScrollDestination {
  pageNumber: number;
  destArray: [
      string | null, // redundant page number - leave empty when calling scrollPageIntoView with 'pageNumber' param
    { name: string }, // destination definition type
      number | null, // x position on the page [null for default/unchanged]
      number | null, // y position on the page [null for default/unchanged]
      number | null // z position on the page (zoom) [null for default/unchanged]
  ];
  allowNegativeOffset: boolean;
  ignoreDestinationZoom: boolean;
}

export interface TextLayerBuilder {
  pageNumber: number;
  textLayerDiv: Element;
}

export interface PDFPageView {
  pageNumber: number;
  textLayer: TextLayerBuilder;
  div: Element;
  viewport: any;
  canvas: any;
}

export interface PDFPageRenderEvent {
  source: PDFPageView;
  pageNumber: number;
}
