import { Component, EventEmitter, Input, Output } from '@angular/core';

import { TaskStatus } from '../rxjs/background-task';

@Component({
  selector: 'app-background-task-progress',
  templateUrl: './background-task-progress.component.html',
})
export class BackgroundTaskProgressComponent {
  @Input() childClass = '';
  @Input() status: TaskStatus;
  @Output() refresh = new EventEmitter<void>();
}
