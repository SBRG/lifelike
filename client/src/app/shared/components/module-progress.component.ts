import { Component, HostBinding, Input } from '@angular/core';

@Component({
  selector: 'app-module-progress',
  templateUrl: './module-progress.component.html',
  styleUrls: ['./module-progress.component.scss']
})
export class ModuleProgressComponent {
  @HostBinding('class') @Input() class = 'position-absolute w-100 h-100 bg-white p-4';
}
