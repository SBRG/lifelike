import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild, ViewEncapsulation } from '@angular/core';

import { uniqueId } from 'lodash-es';
import { combineLatest, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';
import * as d3 from 'd3';
import * as cloud from 'd3.layout.cloud';

import { WordCloudAnnotationFilterEntity } from 'app/interfaces/annotation-filter.interface';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { LegendService } from 'app/shared/services/legend.service';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { AnnotationsService } from 'app/file-browser/services/annotations.service';
import { NodeLegend } from 'app/interfaces';

import { SortingAlgorithm, fileTypeSortingAlgorithms } from '../sorting/sorting-algorithms';
import { WordCloudAnnotationFilterEntityWithLayout } from '../interfaces';

@Component({
  selector: 'app-word-cloud',
  templateUrl: './word-cloud.component.html',
  styleUrls: ['./word-cloud.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class WordCloudComponent implements OnInit, OnDestroy {
  id = uniqueId('WordCloudComponent-');

  @Input() title = 'Entity Cloud';
  @Input() object: FilesystemObject;
  @Input() clickableWords = false;
  @Output() wordOpen = new EventEmitter<WordOpen>();

  @ViewChild('hiddenTextAreaWrapper', {static: false}) hiddenTextAreaWrapperEl: ElementRef;
  @ViewChild('wordCloudWrapper', {static: false}) wordCloudWrapperEl: ElementRef;
  @ViewChild('wordCloudTooltip', {static: false}) wordCloudTooltipEl: ElementRef;
  @ViewChild('wordCloudSvg', {static: false}) wordCloudSvgEl: ElementRef;
  @ViewChild('wordCloudGroup', {static: false}) wordCloudGroupEl: ElementRef;
  layout: any;

  loadTask: BackgroundTask<any, [NodeLegend, string]>;
  annotationsLoadedSub: Subscription;

  wordVisibilityMap: Map<string, boolean> = new Map<string, boolean>();
  annotationData: WordCloudAnnotationFilterEntity[] = [];
  filtersPanelOpened = false;

  legend: Map<string, string> = new Map<string, string>();

  WORD_CLOUD_MARGIN = 10;
  MAX_ALGO_INPUT = 1000;
  FONT_MIN = 12;
  FONT_MAX = 48;

  sorting: SortingAlgorithm;
  sortingAlgorithms: SortingAlgorithm[];

  keywordsShown = true;

  resizeCloud = true;
  cloudResizeObserver: any;

  constructor(protected readonly annotationsService: AnnotationsService,
              protected readonly legendService: LegendService) {
    this.layout = cloud();

    // Initialize the background task
    this.loadTask = new BackgroundTask(({hashId, sortingId}) => {
      return combineLatest(
        this.legendService.getAnnotationLegend(),
        this.annotationsService.getSortedAnnotations(hashId, sortingId),
      );
    });

    // Set up the cloud resize observer.
    // @ts-ignore
    this.cloudResizeObserver = new ResizeObserver(() => {
      this.resizeCloud = true;
    });
  }

  ngOnInit() {
    const sortingForFileType = fileTypeSortingAlgorithms[this.object.mimeType];
    this.sorting = sortingForFileType.default;
    this.sortingAlgorithms = sortingForFileType.all;

    this.annotationsLoadedSub = this.loadTask.results$.pipe(first()).subscribe(() =>
      this.cloudResizeObserver.observe(this.wordCloudWrapperEl.nativeElement)
    );

    // Set the background task callback
    this.annotationsLoadedSub = this.loadTask.results$.subscribe(({result: [legend, annotationExport]}) => {
      // Reset legend
      Object.keys(legend).forEach(label => {
        this.legend.set(label.toLowerCase(), legend[label].color);
      });

      this.setAnnotationData(annotationExport);
    });

    // Send initial data request
    this.getAnnotations();
  }

  ngOnDestroy() {
    this.cloudResizeObserver.unobserve(this.wordCloudWrapperEl.nativeElement);
    this.annotationsLoadedSub.unsubscribe();
  }

  getAnnotationIdentifier(annotation: WordCloudAnnotationFilterEntity) {
    return annotation.id + annotation.type + annotation.keyword;
  }

  /**
   * Sends a request to the BackgroundTask object for new annotations data.
   */
  getAnnotations() {
    this.loadTask.update({hashId: this.object.hashId, sortingId: this.sorting.id});
  }

  sort(algorithm) {
    this.sorting = algorithm;
    this.getAnnotations();
  }

  setAnnotationData(annotationExport: string) {
    // Reset annotation data
    this.annotationData = [];
    this.wordVisibilityMap.clear();

    const uniquePairMap = new Map<string, number>();
    const annotationList = annotationExport.split('\n');

    // remove the headers from tsv response
    annotationList.shift();
    // remove empty line at the end of the tsv response
    annotationList.pop();
    annotationList.forEach(e => {
      //  entity_id	  type	  text	  primary_name  value
      //  col[0]      col[1]  col[2]  col[3]        col[4]
      const cols = e.split('\t');
      const uniquePair = cols[0] === '' ? cols[1] + cols[2] : cols[0] + cols[1];

      if (!uniquePairMap.has(uniquePair)) {
        const annotation = {
          id: cols[0],
          type: cols[1],
          color: this.legend.get(cols[1].toLowerCase()), // Set lowercase to match the legend
          keyword: cols[2],
          primaryName: cols[3],
          text: cols[2],
          frequency: Number(cols[4]),
          shown: true,
        } as WordCloudAnnotationFilterEntity;
        this.wordVisibilityMap.set(
          this.getAnnotationIdentifier(annotation),
          this.sorting.min === undefined || annotation.frequency >= this.sorting.min,
        );
        this.annotationData.push(annotation);
        uniquePairMap.set(uniquePair, this.annotationData.length - 1);
      } else {
        // Add the frequency of the synonym to the original word
        this.annotationData[uniquePairMap.get(uniquePair)].frequency += parseInt(cols[4], 10);

        // And also update the word visibility, since the original frequency might have been 1
        this.wordVisibilityMap.set(this.getAnnotationIdentifier(this.annotationData[uniquePairMap.get(uniquePair)]), true);

        // TODO: In the future, we may want to show "synonyms" somewhere, or even allow the user to swap out the most frequent term for a
        // synonym
      }
    });

    // Need to sort the data, since we may have squashed some terms down and messed with the order given by the API
    this.annotationData = this.annotationData.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Updates the word visibility map to match the input map. Called when the annotation filter wordVisibilityOutput emits.
   * @param newMap word visibility map to copy
   */
  updateWordVisibilityMap(newMap: Map<string, boolean>) {
    this.wordVisibilityMap.clear();
    newMap.forEach((val, key) => {
      this.wordVisibilityMap.set(key, val);
    });
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy());
  }

  /**
   * Redraws the word cloud with updated dimensions to fit the current window.
   */
  fitCloudToWindow() {
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy());
  }

  toggleFiltersPanel() {
    this.filtersPanelOpened = !this.filtersPanelOpened;
  }

  /**
   * Updates the word cloud text to the primary names of each entity, and vice versa.
   */
  toggleShownText() {
    this.annotationData = this.annotationData.map(annotation => {
      annotation.text = this.keywordsShown ? annotation.primaryName : annotation.keyword;
      return annotation;
    });
    this.keywordsShown = !this.keywordsShown;
    this.drawWordCloud(this.getFilteredAnnotationDeepCopy());
  }

  copyWordCloudToClipboard() {
    const hiddenTextAreaWrapper = this.hiddenTextAreaWrapperEl.nativeElement;
    hiddenTextAreaWrapper.style.display = 'block';
    const tempTextArea = document.createElement('textarea');

    hiddenTextAreaWrapper.appendChild(tempTextArea);
    this.annotationData.forEach(annotation => {
      if (this.wordVisibilityMap.get(this.getAnnotationIdentifier(annotation))) {
        tempTextArea.value += `${annotation.text}\n`;
      }
    });
    tempTextArea.select();
    document.execCommand('copy');

    hiddenTextAreaWrapper.removeChild(tempTextArea);
    hiddenTextAreaWrapper.style.display = 'none';
  }

  /**
   * Generates a copy of the annotation data. The reason we do this is the word cloud layout algorithm actually mutates the input data. To
   * keep our API response data pure, we deep copy it and give the copy to the layout algorithm instead.
   */
  private getAnnotationDataDeepCopy() {
    return JSON.parse(JSON.stringify(this.annotationData)) as WordCloudAnnotationFilterEntity[];
  }

  /**
   * Gets a filtered copy of the annotation data. Any word not mapped to 'true' in the wordVisibilityMap will be filtered out.
   */
  getFilteredAnnotationDeepCopy() {
    return this.getAnnotationDataDeepCopy().filter(annotation => this.wordVisibilityMap.get(this.getAnnotationIdentifier(annotation)));
  }

  /**
   * Updates the 'shown' property of the words in annotationData. This property denotes whether the word cloud could draw the word within
   * the given width/height/size constraints. To simplify, each word essentially has three states:
   *
   *   1. The word is visible in the cloud
   *   2. The word is not visible in the cloud, because it was filtered and not considered in the layout algorithm
   *   3. The word is not visible in the cloud, because it could not be drawn with the given size within the given width/height of the
   *    container element
   *
   * This function determines the state of each input word.
   * @param words list of objects representing word data
   */
  private updateWordVisibility(words: WordCloudAnnotationFilterEntity[]) {
    const tempWordMap = new Map<string, WordCloudAnnotationFilterEntity>();
    words.forEach((word) => {
      tempWordMap.set(word.keyword, word);
    });

    for (const word of this.annotationData) {
      // If the word was returned by the algorithm then it is not filtered and it is drawable
      if (tempWordMap.has(word.keyword)) {
        word.shown = true;
      } else {
        // If it wasn't returned BUT it's been filtered, we don't need to show a warning
        if (!this.wordVisibilityMap.get(this.getAnnotationIdentifier(word))) {
          word.shown = true;
        } else {
          // If it wasn't returned but it HASN'T been filtered, we need to show a warning
          word.shown = false;
        }
      }
    }
  }

  /**
   * Generates the width/height for the word cloud svg element. Uses the size of the wrapper element, minus a fixed margin. For example, if
   * the parent is 600px x 600px, and our margin is 10px, the size of the word cloud svg will be 580px x 580px.
   */
  private getCloudSvgDimensions() {
    const margin = {
      top: this.WORD_CLOUD_MARGIN,
      right: this.WORD_CLOUD_MARGIN,
      bottom: this.WORD_CLOUD_MARGIN,
      left: this.WORD_CLOUD_MARGIN,
    };
    const width = this.wordCloudWrapperEl.nativeElement.offsetWidth - margin.left - margin.right;
    const height = this.wordCloudWrapperEl.nativeElement.offsetHeight - margin.top - margin.bottom;
    return {width, height};
  }

  /**
   * Updates the word cloud svg and related elements. Distinct from createInitialWordCloudElements in that it finds the existing elements
   * and updates them if possible. Any existing words will be re-scaled and moved to their new positions, removed words will be removed,
   * and added words will be drawn.
   * @param words list of objects representing terms and their position info as decided by the word cloud layout algorithm
   */
  private updateWordCloudElements(words: WordCloudAnnotationFilterEntityWithLayout[]) {
    this.updateWordVisibility(words);

    // Get grouping element
    const g = d3.select(this.wordCloudGroupEl.nativeElement);

    // Get the tooltip for the word cloud text (this should already be present in the DOM)
    const tooltip = d3.select(this.wordCloudTooltipEl.nativeElement)
      .style('display', 'none');

    // Also create a function for the tooltip content, to be shown when the text is hovered over
    const cloudWrapper = this.wordCloudWrapperEl;
    const keywordsShown = this.keywordsShown;
    const mouseenter = function(d) {
      const coordsOfCloud = cloudWrapper.nativeElement.getBoundingClientRect() as DOMRect;
      const coordsOfText = this.getBoundingClientRect() as DOMRect;
      tooltip
        .html(keywordsShown ? `Primary Name: ${d.primaryName}` : `Text in Document: ${d.keyword}`)
        .style('display', 'block')
        .style('left', (coordsOfText.x - coordsOfCloud.x) + 'px')
        .style('top', (coordsOfText.y - coordsOfCloud.y) + 'px');
    };

    // Get the word elements
    const wordElements = g.selectAll<any, WordCloudAnnotationFilterEntityWithLayout>('text').data(words, d => d.text);

    // Add any new words
    wordElements
      .enter()
      .append('text')
      .text((d) => d.text)
      .merge(wordElements)
      .style('fill', (d) => d.color)
      .attr('text-anchor', 'middle')
      .on('click', (item: WordCloudAnnotationFilterEntity) => {
        this.wordOpen.emit({
          entity: item,
          keywordsShown: this.keywordsShown,
        });
      })
      .attr('class', 'cloud-word' + (this.clickableWords ? ' cloud-word-clickable' : ''))
      .style('font-size', (d) => d.size + 'px')
      .on('mouseenter', mouseenter)
      .on('mouseleave', () => tooltip.style('display', 'none'))
      .transition()
      .attr('transform', (d) => {
        return 'translate(' + [d.x, d.y] + ')rotate(' + d.rotate + ')';
      })
      .ease(d3.easeSin)
      .duration(1000);

    // Remove any words that have been removed by either the algorithm or the user
    wordElements.exit().remove();
  }

  /**
   * Given dataset return normalised font-size generator
   * @param data represents a collection of AnnotationFilterEntity data
   */
  fontSize(data) {
    const frequencies = data.map(annotation => annotation.frequency as number);
    const maximum = Math.max(...frequencies);
    const minimum = Math.min(...frequencies);
    const fontDelta = this.FONT_MAX - this.FONT_MIN;
    return d => {
      const fraction = (d.frequency - minimum) / (maximum - minimum) || 0;
      return (fraction * fontDelta) + this.FONT_MIN;
    };
  }

  /**
   * Draws a word cloud with the given AnnotationFilterEntity inputs using the d3.layout.cloud library.
   * @param data represents a collection of AnnotationFilterEntity data
   */
  drawWordCloud(data: WordCloudAnnotationFilterEntity[]) {
    if (this.resizeCloud) {
      this.resizeCloud = false;

      // Get the dimensions and margins of the graph
      const {width, height} = this.getCloudSvgDimensions();

      // Get the svg element and update
      d3.select(this.wordCloudSvgEl.nativeElement)
        .attr('width', width)
        .attr('height', height);

      // Also update the grouping element
      d3.select(this.wordCloudGroupEl.nativeElement)
        .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

      // ...And update the cloud layout
      this.layout.size([width, height]);
    }

    // Constructs a new cloud layout instance (it runs the algorithm to find the position of words)
    const maxAlgoInputSlice = data.length > this.MAX_ALGO_INPUT ? data.slice(0, this.MAX_ALGO_INPUT) : data;
    this.layout
      .words(maxAlgoInputSlice)
      .padding(3)
      // max ~48px, min ~12px
      .fontSize(this.fontSize(maxAlgoInputSlice))
      .rotate(() => 0)
      // TODO: Maybe in the future we can allow the user to define their own rotation intervals,
      // but for now just keep it simple and don't rotate the words
      /* tslint:disable:no-bitwise*/
      // .rotate(() => (~~(Math.random() * 8) - 3) * 15)
      .on('end', words => this.updateWordCloudElements(words));
    this.layout.start();
  }
}

class WordOpen {
  entity: WordCloudAnnotationFilterEntity;
  keywordsShown: boolean;
}
