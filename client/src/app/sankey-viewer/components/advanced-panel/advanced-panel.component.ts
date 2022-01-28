import { Component, } from '@angular/core';

import { uuidv4 } from 'app/shared/utils';
import { SankeyOptions, SankeyState } from 'app/shared-sankey/interfaces';

import { SankeyControllerService, customisedMultiValueAccessorId } from '../../services/sankey-controller.service';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyAdvancedPanelComponent {
  uuid: string;

  constructor(
    private sankeyController: SankeyControllerService
  ) {
    this.uuid = uuidv4();
  }

  get options(): SankeyOptions {
    return this.sankeyController.options;
  }

  get state(): SankeyState {
    return this.sankeyController.state;
  }

  update() {
    this.sankeyController.applyState();
  }

  customSizingUpdate() {
    this.state.predefinedValueAccessorId = customisedMultiValueAccessorId;
    this.update();
  }
}
