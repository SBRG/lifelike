import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, } from '@angular/core';
import { FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators, } from '@angular/forms';

import { isNil, uniqueId } from 'lodash-es';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import {
  AnnotationFilterEntity,
  AnnotationVisibility,
  DefaultGroupByOptions,
  DefaultOrderByOptions,
  OrderDirection,
} from 'app/interfaces/annotation-filter.interface';
import { SortingAlgorithm } from 'app/word-cloud/sorting/sorting-algorithms';

@Component({
  selector: 'app-annotation-filter',
  templateUrl: './annotation-filter.component.html',
  styleUrls: ['./annotation-filter.component.scss'],
})
export class AnnotationFilterComponent<T extends AnnotationFilterEntity> implements OnInit, OnDestroy {
  id = uniqueId('AnnotationFilterComponent-');

  _sortingAlgorithm: SortingAlgorithm;
  _annotationData: T[];

  outputSubject: Subject<boolean>;
  outputSubjectSub: Subscription;

  wordVisibilityMap: Map<string, boolean>;
  wordVisibilityChanged: boolean;
  annotationVisibility: AnnotationVisibility[];

  typeVisibilityMap: Map<string, boolean>;
  disabledTypeMap: Map<string, boolean>;

  filtersForm: FormGroup;
  filtersFormValueChangesSub: Subscription;

  minimumValueInputId: string;
  maximumValueInputId: string;

  selectedGroupByOption: string;
  selectedOrderByOption: string;
  selectedOrderDirection: string;
  groupByOptions: string[];
  orderByOptions: string[];
  orderDirections: string[];

  legend: Map<string, string>;

  initialized = false;

  @Output() wordVisibilityOutput: EventEmitter<Map<string, boolean>>;

  @Input() set annotationData(data: T[]) {
    this._annotationData = data;
    // Get all the annotation types to populate the legend
    data.forEach((annotation) => {
      this.legend.set(annotation.type, annotation.color);
    });

    // For each NEW type in the legend, set the visibility of that type to true by default. For any existing type, use the current
    // visibility.
    this.legend.forEach((_, type) => {
      this.typeVisibilityMap.set(type, this.typeVisibilityMap.has(type) ? this.typeVisibilityMap.get(type) : true);
    });

    // When the component is initially created, we apply the default filters and emit to the parent, and on subsequent data loads we also
    // need to apply the filters and output to the parent.
    if (this.initialized) {
      this.applyFilters();
      this.outputSubject.next();
    }
  }

  get annotationData() {
    return this._annotationData;
  }

  @Input() set sortingAlgorithm(sa: SortingAlgorithm) {
    this._sortingAlgorithm = sa;
    this.setDefaultFrequency();
  }

  get sortingAlgorithm() {
    return this._sortingAlgorithm;
  }

  constructor() {
    this.outputSubject = new Subject<boolean>();

    this.wordVisibilityMap = new Map<string, boolean>();
    this.typeVisibilityMap = new Map<string, boolean>();
    this.disabledTypeMap = new Map<string, boolean>();

    this.selectedOrderByOption = DefaultOrderByOptions.FREQUENCY;
    this.selectedOrderDirection = OrderDirection.DESCENDING;

    this.minimumValueInputId = `${this.id}-mininum-frequency-input`;
    this.maximumValueInputId = `${this.id}-maximum-frequency-input`;

    this.wordVisibilityOutput = new EventEmitter<Map<string, boolean>>();

    this.setGroupByOptions();
    this.setOrderByOptions();
    this.setOrderDirections();

    this.legend = new Map<string, string>();
  }

  ngOnInit() {
    const validators = [
      Validators.required
    ];
    if (this.sortingAlgorithm.hasOwnProperty('min')) {
      validators.push(Validators.min(this.sortingAlgorithm.min));
    }
    if (this.sortingAlgorithm.step === 1) {
      validators.push(Validators.pattern(/^-?[0-9]*\.?[0-9]*$/));
    }
    this.filtersForm = new FormGroup(
      // Form controls
      {
        minimumValue: new FormControl(0, validators),
        // TODO: Removing for now, may bring back
        // maximumValue: new FormControl(
        //   0, [Validators.required, Validators.min(0), Validators.pattern(/^-?[0-9][^\.]*$/)]
        // ),
      }
      // Form group validators
      // TODO: Don't need this right now, bring it back later if we bring back max frequency
      // [this.minMaxFreqValidator()]
    );

    // The very first time we get the annotationData, set the default values for the frequency filters
    if (this.sortingAlgorithm.hasOwnProperty('default')) {
      this.filtersForm.get('minimumValue').setValue(this.sortingAlgorithm.default);
    }
    // TODO: Uncomment if we bring back max frequency
    // this.filtersForm.get('maximumValue').setValue(this.annotationData[0].frequency);

    // Basically debounces the word visibility output. Any time the parent component should know about visibility changes, we should emit a
    // new value to `outputSubject`, rather than emitting to `wordVisibilityOutput` directly.
    this.outputSubjectSub = this.outputSubject
      .asObservable()
      .pipe(debounceTime(250))
      .subscribe(() => {
        this.wordVisibilityOutput.emit(this.wordVisibilityMap);
      });

    // Anytime the frequency filters change, output to the parent so the word cloud is redrawn.
    this.filtersFormValueChangesSub = this.filtersForm.valueChanges.subscribe(
      () => {
        if (this.filtersForm.valid) {
          this.applyFilters();
          this.outputSubject.next();
        }
      }
    );

    // Apply filters to initial data and output to parent
    this.applyFilters();
    this.outputSubject.next();
    this.initialized = true;
  }

  setDefaultFrequency() {
    const {filtersForm, sortingAlgorithm} = this;
    if (filtersForm && sortingAlgorithm.hasOwnProperty('default')) {
      this.filtersForm.get('minimumValue').setValue(this.sortingAlgorithm.default);
    }
  }

  updateVisibility() {
    this.annotationVisibility = this.annotationData.map((entity) => {
      const identifier = this.getAnnotationIdentifier(entity);
      return {
        identifier,
        visible: this.isWordVisible(identifier),
        entity,
      };
    });
  }

  ngOnDestroy() {
    // `complete` effectively unsubscribes from the `outputSubjectSub`, so we don't need to manually unsubscribe from it here.
    this.outputSubject.complete();
    this.filtersFormValueChangesSub.unsubscribe();
  }

  getAnnotationIdentifier(annotation: T) {
    return annotation.id + annotation.type + annotation.keyword;
  }

  isWordVisible(identifier: string) {
    const value = this.wordVisibilityMap.get(identifier);
    if (value === undefined) {
      return true;
    } else {
      return value;
    }
  }

  isTypeVisible(type: string) {
    const value = this.typeVisibilityMap.get(type);
    if (value === undefined) {
      return true;
    } else {
      return value;
    }
  }

  /**
   * Changes the filter state of the given annotation to the given input state.
   * @param identifier string representing the annotation to change the state of
   * @param event checkbox event object containing the new state
   */
  changeWordVisibility(identifier: string, event) {
    this.wordVisibilityMap.set(identifier, event.target.checked);
    this.invalidateWordVisibility();
    this.invalidateTypeVisibility();
    this.updateVisibility();
    this.outputSubject.next();
  }

  changeTypeVisibility(type: string, event) {
    this.typeVisibilityMap.set(type, event.target.checked);

    this.annotationData.forEach((annotation) => {
      if (annotation.type === type) {
        this.wordVisibilityMap.set(
          this.getAnnotationIdentifier(annotation),
          this.typeVisibilityMap.get(annotation.type)
        );
      }

      // If we set the visibility of annotations with this type to 'true', then do a second filter on frequency so we don't show anything
      // not in the range.
      if (this.typeVisibilityMap.get(annotation.type)) {
        this.wordVisibilityMap.set(
          this.getAnnotationIdentifier(annotation),
          this.filterByFrequency(annotation)
        );
      }
    });

    this.invalidateWordVisibility();
    this.invalidateTypeVisibility();

    this.groupAndSortData();
    this.outputSubject.next();
  }

  /**
   * Sets all words in the word visibility map to the input state.
   * @param state boolean true/false representing a filter state for the word cloud
   */
  setAllWordsVisibility(state: boolean) {
    for (const annotation of this.annotationData) {
      this.wordVisibilityMap.set(
        this.getAnnotationIdentifier(annotation),
        state
      );
      this.typeVisibilityMap.set(annotation.type, state);

      // If we set the global state to 'true', then we should apply the current range filter
      if (state) {
        this.wordVisibilityMap.set(
          this.getAnnotationIdentifier(annotation),
          this.filterByFrequency(annotation)
        );
      }
    }
    this.invalidateWordVisibility();
    this.invalidateTypeVisibility();
    this.updateVisibility();
    this.outputSubject.next();
  }

  setGroupByOptions() {
    this.groupByOptions = [];
    this.selectedGroupByOption = DefaultGroupByOptions.NONE;
    for (const option in DefaultGroupByOptions) {
      if (typeof option === 'string') {
        this.groupByOptions.push(DefaultGroupByOptions[option]);
      }
    }
  }

  // TODO: This is effectively unused, may bring it back once we have more order by options
  setOrderByOptions() {
    this.orderByOptions = [];
    this.selectedOrderByOption = DefaultOrderByOptions.FREQUENCY;
    for (const option in DefaultOrderByOptions) {
      if (typeof option === 'string') {
        this.orderByOptions.push(DefaultOrderByOptions[option]);
      }
    }
  }

  // TODO: Effectively unused, may bring it back if we decide ordering direction is important
  setOrderDirections() {
    this.orderDirections = [];
    this.selectedOrderDirection = OrderDirection.DESCENDING;
    for (const option in OrderDirection) {
      if (typeof option === 'string') {
        this.orderDirections.push(OrderDirection[option]);
      }
    }
  }

  sortData() {
    switch (this.selectedOrderByOption) {
      case DefaultOrderByOptions.FREQUENCY:
        this.annotationData.sort((a, b) =>
          this.sortByFrequency(a, b, this.selectedOrderDirection)
        );
        break;
    }
  }

  groupData() {
    switch (this.selectedGroupByOption) {
      case DefaultGroupByOptions.ENTITY_TYPE:
        this.groupDataByEntityType();
        break;
      // TODO: Bring this back if we decide to group on filtered in the future
      // case DefaultGroupByOptions.FILTERED:
      //   this.groupDataByFilteredState();
      //   break;
      case DefaultGroupByOptions.NONE:
      default:
        break;
    }
  }

  groupAndSortData() {
    this.sortData();
    this.groupData();
    this.updateVisibility();
  }

  private sortByFrequency(
    a: T,
    b: T,
    direction: string
  ) {
    return direction === OrderDirection.DESCENDING
      ? b.frequency - a.frequency
      : a.frequency - b.frequency;
  }

  private sortByType(
    a: T,
    b: T,
    direction: string
  ) {
    if (b.type === a.type) {
      return 0;
    }
    if (direction === OrderDirection.DESCENDING) {
      return b.type > a.type ? 1 : -1;
    } else {
      return a.type > b.type ? 1 : -1;
    }
  }

  private groupDataByEntityType() {
    this.annotationData.sort((a, b) => {
      // TODO: Setting the default type sort direction to ascending, may want to change this in the future.
      const sortByTypeResult = this.sortByType(a, b, OrderDirection.ASCENDING);
      const sortByFrequencyResult = this.sortByFrequency(a, b, this.selectedOrderDirection);
      return sortByTypeResult === 0 ? sortByFrequencyResult : sortByTypeResult;
    });
  }

  // TODO: Effectively unused, but keeping because we might add it back in the future
  private groupDataByFilteredState() {
    const filteredList = [];
    const unfilteredList = [];

    this.annotationData.forEach((annotation) => {
      if (
        this.wordVisibilityMap.get(this.getAnnotationIdentifier(annotation))
      ) {
        unfilteredList.push(annotation);
      } else {
        filteredList.push(annotation);
      }
    });
    // TODO: If we use this function in the future, need to refactor this to not use assignment! annotationData should only be assigned a
    // value when the parent supplies a new input value.
    this.annotationData = unfilteredList.concat(filteredList);
  }

  // TODO: Should consider wrapping the invalidation of word/type visibility into a single function, right now we do a lot of unnecessary
  // looping...Not a huge problem because the lists are generally going to be relatively small, but it may be a problem in the future.

  /**
   * Determines whether any words in the word cloud have been filtered. We use this to determine which (if any) of the buttons on the
   * widget to disable/enable. If any word not below the current frequency filter has been manually filtered, we show 'Show All'. If all
   * words not below the filter are shown, then we show 'Hide All'.
   */
  private invalidateWordVisibility() {
    // Keep track if the user has some entity types disabled
    let wordVisibilityChanged = false;

    this.annotationData.forEach((annotation) => {
      if (
        !this.wordVisibilityMap.get(this.getAnnotationIdentifier(annotation)) &&
        this.filterByFrequency(annotation)
      ) {
        wordVisibilityChanged = true;
      }
    });
    this.wordVisibilityChanged = wordVisibilityChanged;
  }

  /**
   * Checks the visibility status of each annotation type and sets them accordingly. For example, if all 'Chemical' are filtered, then the
   * 'Chemical' option in the legend will be unchecked. If any 'Chemical' are not filtered, it is checked.
   */
  private invalidateTypeVisibility() {
    this.typeVisibilityMap.forEach((_, key) => {
      this.typeVisibilityMap.set(key, false);
      this.disabledTypeMap.set(key, true);
    });

    this.annotationData.forEach((annotation) => {
      if (
        this.wordVisibilityMap.get(this.getAnnotationIdentifier(annotation))
      ) {
        this.typeVisibilityMap.set(annotation.type, true);
      }

      if (this.filterByFrequency(annotation)) {
        this.disabledTypeMap.set(annotation.type, false);
      }
    });
  }

  /**
   * Sets visibility to false for all entities that are not within the range specified by the user. This DOES NOT redraw the cloud! The
   * calling function should bre responsible for the redraw.
   */
  private filterByFrequency(annotation: T) {
    const minimumValue = this.filtersForm.get('minimumValue').value;

    // TODO: Uncomment these if we bring back max frequency
    // const maximumValue = this.filtersForm.get('maximumValue').value;

    // return minimumValue <= annotation.frequency && annotation.frequency <= maximumValue;

    return minimumValue <= annotation.frequency;
  }

  /**
   * Helper function for applying all filter and grouping methods simultaneously. Used by the filter form submission/on-changes function.
   */
  private applyFilters() {
    for (const annotation of this.annotationData) {
      const state = this.filterByFrequency(annotation);
      this.wordVisibilityMap.set(
        this.getAnnotationIdentifier(annotation),
        state && this.typeVisibilityMap.get(annotation.type)
      );
    }
    this.invalidateTypeVisibility();
    this.invalidateWordVisibility();
    this.groupAndSortData();
  }

  // TODO: Currently unused, may bring it back in the future
  /**
   * Validation function used by the filter form group to check validity of the maximum and minimum frequency values.
   */
  private minMaxFreqValidator(): ValidatorFn {
    return (fg: FormGroup): ValidationErrors => {
      const minFreqControl = fg.get('minimumValue');
      const maxFreqControl = fg.get('maximumValue');

      if (minFreqControl.value > maxFreqControl.value) {
        minFreqControl.setErrors({...minFreqControl.errors, badMinMax: true});
        maxFreqControl.setErrors({...maxFreqControl.errors, badMinMax: true});
      } else {
        let minFreqControlErrors = minFreqControl.errors;
        let maxFreqControlErrors = maxFreqControl.errors;

        // Need to remove the 'badMinMax' property entirely from the errors object; as long as the property exists, the error is assumed to
        // exist
        if (!isNil(minFreqControlErrors)) {
          delete minFreqControlErrors.badMinMax;

          // If there are no more properties in the errors object, we need to set errors to null in order for it to be recognized as valid
          // (an empty object will still mark the control as invalid)
          if (Object.keys(minFreqControlErrors).length === 0) {
            minFreqControlErrors = null;
          }
        }

        // Do the same for the max frequency control
        if (!isNil(maxFreqControlErrors)) {
          delete maxFreqControlErrors.badMinMax;

          if (Object.keys(maxFreqControlErrors).length === 0) {
            maxFreqControlErrors = null;
          }
        }

        minFreqControl.setErrors(minFreqControlErrors);
        maxFreqControl.setErrors(maxFreqControlErrors);
      }

      return fg.errors;
    };
  }
}
