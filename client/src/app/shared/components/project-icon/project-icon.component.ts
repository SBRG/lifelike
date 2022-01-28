import { Component, Input } from '@angular/core';

import { ProjectImpl } from 'app/file-browser/models/filesystem-object';
import { hslToRgb } from 'app/shared/utils/colors';

@Component({
  selector: 'app-project-icon',
  templateUrl: './project-icon.component.html',
  styleUrls: [
    './project-icon.component.scss',
  ],
})
export class ProjectIconComponent {

  @Input() project: ProjectImpl;
  @Input() size = '24px';

  generateBackground() {
    const [r, g, b] = hslToRgb(this.project.colorHue, 0.7, 0.95);
    return `rgb(${r}, ${g}, ${b})`;
  }

}
