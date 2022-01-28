import { Directive, EventEmitter, Input, Output, HostBinding, HostListener } from '@angular/core';

export enum SortDirection {
  asc = 'asc',
  desc = 'desc',
  none = 'none'
}

export type SortDirectionType = keyof typeof SortDirection | false | 0 | '' | null | undefined;

const rotate: { [key: string]: SortDirectionType } = {
  [SortDirection.asc]: SortDirection.desc,
  [SortDirection.desc]: SortDirection.none,
  [SortDirection.none]: SortDirection.asc
};

export interface SortEvent {
  column: any;
  direction: SortDirectionType;
}

@Directive({
  selector: 'th[appSortable]'
})
export class SortableTableHeaderDirective {
  @Input() sortable: any;
  @Input() direction: SortDirectionType;
  @Output() sort = new EventEmitter<SortEvent>();

  @HostBinding('class.asc') isAsc = () => this.direction === SortDirection.asc;
  @HostBinding('class.desc') isDesc = () => this.direction === SortDirection.desc;

  @HostListener('click') rotate() {
    this.direction = rotate[this.direction || 'none'];
    this.sort.emit({column: this.sortable, direction: this.direction});
  }
}
