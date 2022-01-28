import { Component, } from '@angular/core';

import { uuidv4 } from 'app/shared/utils';
import { SankeyControllerService, customisedMultiValueAccessorId } from 'app/sankey-viewer/services/sankey-controller.service';

import { SankeyManyToManyState, SankeyManyToManyOptions } from '../interfaces';


@Component({
  selector: 'app-sankey-advanced-panel',
  templateUrl: './advanced-panel.component.html',
  styleUrls: ['./advanced-panel.component.scss'],
})
export class SankeyManyToManyAdvancedPanelComponent {
  uuid: string;

  constructor(
    private sankeyController: SankeyControllerService
  ) {
    this.uuid = uuidv4();
  }

  get options(): SankeyManyToManyOptions {
    // @ts-ignore
    return this.sankeyController.options;
  }

  get state(): SankeyManyToManyState {
    // @ts-ignore
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
