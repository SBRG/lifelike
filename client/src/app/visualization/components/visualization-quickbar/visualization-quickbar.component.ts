import {
    Component,
    EventEmitter,
    Output,
} from '@angular/core';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

@Component({
    selector: 'app-visualization-quickbar',
    templateUrl: './visualization-quickbar.component.html',
    styleUrls: ['./visualization-quickbar.component.scss'],
})
export class VisualizationQuickbarComponent {
    @Output() animationStatus = new EventEmitter<boolean>();

    constructor() {}

    animationToggle($event: MatSlideToggleChange) {
        this.animationStatus.emit($event.checked);
    }
}
