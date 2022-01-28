import { Component } from '@angular/core';

import { SankeySearchService } from '../../services/search.service';

@Component({
  selector: 'app-sankey-search-control',
  templateUrl: './search-control.component.html'
})
export class SankeySearchControlComponent {
  constructor(
    public search: SankeySearchService
  ) {
  }
}
