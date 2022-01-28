import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, ViewEncapsulation, EventEmitter, Output } from '@angular/core';

import * as d3 from 'd3';
import * as cloud from 'd3.layout.cloud';

import { WordCloudFilterEntity } from 'app/interfaces/filter.interface';
import { WordCloudAnnotationFilterEntityWithLayout } from 'app/word-cloud/interfaces';

/**
 * Throttles calling `fn` once per animation frame
 * Latest arguments are used on the actual call
 * @param fn - function which calls should be throttled
 */
export function throttled(fn: (...r: any[]) => void) {
  let ticking = false;
  let args = [];
  return (...rest) => {
    args = Array.prototype.slice.call(rest);
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        fn.apply(window, args);
      });
    }
  };
}

export interface WordCloudNode {
  value?: any;
  result?: any;
  frequency: any;
  text?: any;
  shown?: any;
  id?: any;
  type?: any;
  color?: any;
}

/**
 * Generates a copy of the  data. The reason we do this is the word cloud layout algorithm actually mutates the input data. To
 * keep our API response data pure, we deep copy it and give the copy to the layout algorithm instead.
 */
function deepCopy(data) {
  return JSON.parse(JSON.stringify(data)) as WordCloudFilterEntity[];
}

// todo: replace with { createResizeObservable } from 'app/shared/rxjs/resize-observable';
const createResizeObserver = (callback, container) => {
  const resize = throttled(async (width, height) => {
    const w = container.clientWidth;
    await callback(width, height - 42);
    if (w < container.clientWidth) {
      // If the container size shrank during chart resize, let's assume
      // scrollbar appeared. So we resize again with the scrollbar visible -
      // effectively making chart smaller and the scrollbar hidden again.
      // Because we are inside `throttled`, and currently `ticking`, scroll
      // events are ignored during this whole 2 resize process.
      // If we assumed wrong and something else happened, we are resizing
      // twice in a frame (potential performance issue)
      await callback(container.offsetWidth, container.offsetHeight - 42);
    }
  });

  // @ts-ignore until https://github.com/microsoft/TypeScript/issues/37861 implemented
  const observer = new ResizeObserver(entries => {
    const entry = entries[0];
    const width = entry.contentRect.width;
    const height = entry.contentRect.height;
    // When its container's display is set to 'none' the callback will be called with a
    // size of (0, 0), which will cause the chart to lost its original height, so skip
    // resizing in such case.
    if (width === 0 && height === 0) {
      return;
    }
    resize(width, height);
  });
  // todo
  observer.observe(container);
  return observer;
};

@Component({
  selector: 'app-word-cloud',
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class WordCloudComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cloudWrapper', {static: false}) cloudWrapper!: ElementRef;
  @ViewChild('hiddenTextAreaWrapper', {static: false}) hiddenTextAreaWrapper!: ElementRef;
  @ViewChild('svg', {static: false}) svg!: ElementRef;
  @ViewChild('g', {static: false}) g!: ElementRef;
  @Output() enter = new EventEmitter();

  private _data: (string | WordCloudNode)[] = [];

  WORD_CLOUD_MARGIN = 10;

  margin = {
    top: this.WORD_CLOUD_MARGIN,
    right: this.WORD_CLOUD_MARGIN,
    bottom: this.WORD_CLOUD_MARGIN,
    left: this.WORD_CLOUD_MARGIN
  };

  MIN_FONT = 12;
  MAX_FONT = 48;

  private layout: any;
  resizeObserver: any;

  private _timeInterval = Infinity;
  @Input() set timeInterval(ti) {
    if (this.layout) {
      this._timeInterval = ti;
      this.layout.timeInterval(ti);
    }
  }

  get timeInterval() {
    return this._timeInterval;
  }

  constructor() {
    this.layout = cloud()
      .padding(1)
      .timeInterval(this.timeInterval)
      // ~~ faster substitute for Math.floor() for positive numbers
      // http://rocha.la/JavaScript-bitwise-operators-in-practice
      // tslint:disable-next-line:no-bitwise
      // .rotate(d => d.rotate || (~~(Math.random() * 6) - 3) * 30);
      .rotate(_ => 0);
  }

  @Input('data') set data(data) {
    const count: any = {};
    if (Array.isArray(data) && data.every(d => typeof d === 'string' && (count[d] = (count[d] || 0) + 1))) {
      this._data = Object.entries(count).map(([text, frequency]) => ({text, frequency}));
    } else {
      this._data = deepCopy(data);
    }
    if (this.svg) {
      this.updateLayout(this._data).then(this.updateDOM.bind(this));
    }
  }

  get data() {
    return this._data;
  }


  ngAfterViewInit() {
    const {width, height} = this.getCloudSvgDimensions();
    this.layout.canvas(this.hiddenTextAreaWrapper.nativeElement);
    this.onResize(width, height).then();
    this.resizeObserver = createResizeObserver(this.onResize.bind(this), this.cloudWrapper.nativeElement);
  }

  ngOnDestroy() {
    this.resizeObserver.disconnect();
    delete this.resizeObserver;
  }

  onResize(width, height) {
    // Get the svg element and update
    d3.select(this.svg.nativeElement)
      .attr('width', width)
      .attr('height', height);

    // Get and update the grouping element
    d3.select(this.g.nativeElement)
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

    this.layout.size([width, height]);

    return this.updateLayout(this.data).then(this.updateDOM.bind(this));
  }

  getFontSize(normSize) {
    return this.MIN_FONT + (normSize || 0) * (this.MAX_FONT - this.MIN_FONT);
  }

  /**
   * Draws a word cloud with the given FilterEntity inputs using the d3.layout.cloud library.
   * @param data represents a collection of FilterEntity data
   */
  updateLayout(data) {
    // Reference for this code: https://www.d3-graph-gallery.com/graph/wordcloud_basic
    const freqValues = data.map(d => d.frequency as number);
    const maximumCount = Math.max(...freqValues);
    const minimumCount = Math.min(...freqValues);

    return new Promise(resolve => {
      // Constructs a new cloud layout instance (it runs the algorithm to find the position of words)
      this.layout
        .words(data)
        .fontSize(d => this.getFontSize((d.frequency - minimumCount) / maximumCount))
        .on('end', placedWords => {
          const notPlaced = data.length - placedWords.length;
          if (notPlaced) {
            console.warn(`${notPlaced} words did not fit into cloud`);
          }
          resolve(placedWords);
        })
        .start();
    });

  }


  /**
   * Generates the width/height for the word cloud svg element. Uses the size of the wrapper element, minus a fixed margin. For example, if
   * the parent is 600px x 600px, and our margin is 10px, the size of the word cloud svg will be 580px x 580px.
   */
  private getCloudSvgDimensions() {
    const cloudWrapper = this.cloudWrapper.nativeElement;
    const {margin} = this;
    return {
      width: cloudWrapper.offsetWidth - margin.left - margin.right,
      height: cloudWrapper.offsetHeight - margin.top - margin.bottom
    };
  }

  /**
   * Creates the word cloud svg and related elements. Also creates 'text' elements for each value in the 'words' input.
   * @param words list of objects representing terms and their position info as decided by the word cloud layout algorithm
   */
  /**
   * Updates the word cloud svg and related elements. Distinct from createInitialWordCloudElements in that it finds the existing elements
   * and updates them if possible. Any existing words will be re-scaled and moved to their new positions, removed words will be removed,
   * and added words will be drawn.
   * @param words list of objects representing terms and their position info as decided by the word cloud layout algorithm
   */
  private updateDOM(words: WordCloudAnnotationFilterEntityWithLayout[]) {
    // Add any new words
    return d3.select(this.g.nativeElement)
      .selectAll('text')
      // @ts-ignore
      .data<WordCloudAnnotationFilterEntityWithLayout>(words, d => d.text)
      .join(
        enter => enter
          .append('text')
          .attr('text-anchor', 'middle')
          .text(d => d.text)
          .call(e => this.enter.emit(e)),
        update => update,
        // Remove any words that have been removed by either the algorithm or the user
        exit => exit.remove()
      )
      .style('fill', d => d.color)
      .style('font-size', d => d.size + 'px')
      .transition()
      .attr('transform', d => {
        return 'translate(' + [d.x, d.y] + ') rotate(' + d.rotate + ')';
      })
      .ease(d3.easeSin)
      .duration(1000);
  }
}
