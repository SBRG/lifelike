import { Component, Input } from '@angular/core';

import { TaskStatus } from '../rxjs/background-task';

@Component({
  selector: 'app-content-progress',
  templateUrl: './content-progress.component.html',
})
export class ContentProgressComponent {
  @Input() status: TaskStatus;
  @Input() loadingText: string;
  @Input() errorText: string;
}
