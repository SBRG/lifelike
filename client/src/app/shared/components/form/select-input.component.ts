/* tslint:disable:member-ordering */
import {
  AfterViewChecked,
  AfterViewInit,
  Component,
  ContentChild,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  Renderer2,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

import { fromEvent, Subscription } from 'rxjs';

import { DropdownController, FitOptions } from '../../utils/dom/dropdown-controller';
import { MouseNavigableDirective } from '../../directives/mouse-navigable.directive';

@Component({
  selector: 'app-select-input',
  templateUrl: './select-input.component.html',
  styleUrls: [
    './select-input.component.scss',
  ],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: SelectInputComponent,
    multi: true,
  }],
})
export class SelectInputComponent<T extends { label?: string }>
  implements OnDestroy, OnChanges, AfterViewInit, AfterViewChecked, ControlValueAccessor {

  // TODO: Handle wrapping

  @Input() choices: T[] = [];
  @Input() choiceToKey: (choice: T) => any = (choice) => choice;
  @Input() noResultsText = 'No suggestions';
  @Input() multiple = false;
  @Input() placeholder = '';
  @Input() loading = false;
  @Output() choiceListRequest = new EventEmitter<ChoiceListRequest>();

  @ViewChild('inputContainer', {static: true}) inputContainerElement: ElementRef;
  @ViewChild('input', {static: true}) inputElement: ElementRef;
  @ViewChild('dropdown', {static: true}) dropdownElement: ElementRef;
  @ViewChild(MouseNavigableDirective, {
    static: true,
    read: MouseNavigableDirective,
  }) mouseNavigableDirective;
  @ContentChild('inputChoiceTemplate', {static: false}) inputChoiceTemplateRef: TemplateRef<any>;
  @ContentChild('dropdownChoiceTemplate', {static: false}) dropdownChoiceTemplateRef: TemplateRef<any>;
  @ContentChild('noResultsTemplate', {static: false}) noResultsTemplateRef: TemplateRef<any>;

  selection: Map<any, T> = new Map<any, T>();
  unselectedChoices: T[] = [];
  request: ChoiceListRequest = {
    query: '',
  };
  protected dropdownController: DropdownController;
  protected changeCallback: ((value: any) => any) | undefined;
  protected touchCallback: (() => any) | undefined;
  protected readonly subscriptions = new Subscription();

  constructor(protected readonly element: ElementRef,
              protected readonly renderer: Renderer2) {
  }

  // Lifecycle
  // ---------------------------------

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ('choices' in changes) {
      this.updateUnselectedChoices(changes.choices.currentValue);
    }
    if ('placeholder' in changes) {
      if (this.inputElement) {
        this.updatePlaceholder();
      }
    }
  }

  ngAfterViewInit() {
    this.dropdownController = new DropdownController(
      this.renderer,
      this.element.nativeElement,
      this.dropdownElement.nativeElement, {
        viewportSpacing: 5,
        fixedAnchorPoint: true,
      },
    );

    this.subscriptions.add(fromEvent(document.body, 'contextmenu', {
      capture: true,
    }).subscribe(this.onInteractionEvent.bind(this)));
    this.subscriptions.add(fromEvent(document.body, 'click', {
      capture: true,
    }).subscribe(this.onInteractionEvent.bind(this)));
    this.subscriptions.add(fromEvent(document.body, 'focusin', {
      capture: true,
    }).subscribe(this.onInteractionEvent.bind(this)));

    this.updatePlaceholder();
  }

  ngAfterViewChecked() {
    if (this.dropdownController != null) {
      this.dropdownController.fit(this.fitOptions);
    }
  }

  // Events
  // ---------------------------------

  onInteractionEvent(e) {
    this.closeDropdownIfNotFocused(e.target);
  }

  onContainerClick(event: MouseEvent) {
    this.focusInput();
  }

  onInputKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      const first = this.mouseNavigableDirective.getFirst();
      if (first != null) {
        first.focus();
        first.scrollIntoView();
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      const last = this.mouseNavigableDirective.getLast();
      if (last != null) {
        last.focus();
        last.scrollIntoView();
      }
    } else if (event.key === 'Escape') {
      this.focusOut();
    } else if (event.key === 'Enter') {
      event.preventDefault();
    } else if (event.key === 'Backspace') {
      const textSelection = window.getSelection();
      if (textSelection.rangeCount) {
        const range = textSelection.getRangeAt(0);
        if (range.commonAncestorContainer === this.inputElement.nativeElement
          && range.startOffset === 0 && range.endOffset === 0) {
          if (this.selection.size) {
            const selection = this.selectedChoices;
            this.deselect(selection[selection.length - 1]);
          }
        }
      }
    } else {
      this.openDropdown();
    }
  }

  onInputKeyUp(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
    } else {
      this.updateQuery();
      this.openDropdown();
      this.focusInput();
    }
  }

  onInputPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  }

  onInputFocus(event) {
    this.openDropdown();
  }

  onDropdownKeyUpPressed(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.focusOut();
      this.focusInput();
    }
  }

  onItemKeyPress(event: KeyboardEvent, choice: T) {
    if (event.code === 'Enter' || event.code === 'Space') {
      event.preventDefault();
      this.toggle(choice);
    }
  }

  // Update methods
  // ---------------------------------

  protected updateQuery() {
    this.request = {
      query: this.inputElement.nativeElement.textContent,
    };
    this.choiceListRequest.emit(this.request);
  }

  protected updateUnselectedChoices(choices: T[]) {
    this.unselectedChoices = (choices as T[])
      .filter(choice => !this.isSelected(choice));
  }

  protected updatePlaceholder() {
    // @ts-ignore
    const escapedPlaceholder = window.CSS && CSS.escape ? CSS.escape(this.placeholder) :
      this.placeholder.replace(/'/g, '');
    this.inputElement.nativeElement.style.setProperty('--placeholder-text',
      `'${escapedPlaceholder}'`);
  }

  // Dropdown control
  // ---------------------------------

  get fitOptions(): FitOptions {
    return {
      maxWidth: 250,
    };
  }

  protected openDropdown() {
    this.dropdownController.openRelative(this.inputElement.nativeElement, {
      placement: 'bottom-left',
      ...this.fitOptions,
    });
  }

  protected closeDropdown() {
    this.dropdownController.close();
  }

  private closeDropdownIfNotFocused(target: EventTarget | null) {
    if (target != null) {
      if (target !== this.inputElement.nativeElement &&
        !this.dropdownElement.nativeElement.contains(target)) {
        this.focusOut();
      }
    }
  }

  // Input control
  // ---------------------------------

  protected focusOut() {
    this.closeDropdown();
  }

  focusInput() {
    this.inputElement.nativeElement.focus();
    this.openDropdown();
  }

  // Input and selection
  // ---------------------------------

  get hasInput() {
    return this.selection.size || this.inputElement.nativeElement.innerText.length;
  }

  get selectedChoices() {
    return [...this.selection.values()];
  }

  clear() {
    this.selection.clear();
    this.handleSelectionChange();
  }

  select(choice: T) {
    if (!this.multiple) {
      this.clear();
    }
    this.selection.set(this.choiceToKey(choice), choice);
    this.handleSelectionChange();
  }

  deselect(choice: T) {
    this.selection.delete(this.choiceToKey(choice));
    this.handleSelectionChange();
  }

  toggle(choice: T) {
    if (this.isSelected(choice)) {
      this.deselect(choice);
    } else {
      this.select(choice);
    }
  }

  isSelected(choice: T) {
    return this.selection.has(this.choiceToKey(choice));
  }

  protected handleSelectionChange() {
    if (this.changeCallback) {
      this.changeCallback(this.selectedChoices);
    }
    if (this.touchCallback) {
      this.touchCallback();
    }
    this.inputElement.nativeElement.innerText = '';
    this.updateQuery();
    this.updateUnselectedChoices(this.choices);
    this.focusInput();
    if (!this.multiple) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  // Forms
  // ---------------------------------

  registerOnChange(fn): void {
    this.changeCallback = fn;
  }

  registerOnTouched(fn): void {
    this.touchCallback = fn;
  }

  writeValue(obj: any): void {
    this.selection.clear();
    if (obj != null) {
      for (const choice of obj) {
        this.selection.set(this.choiceToKey(choice), choice);
      }
    }
  }
}

export interface ChoiceListRequest {
  query: string;
}
