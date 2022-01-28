import { Component, Input } from '@angular/core';

import { EnrichmentDocument } from '../../models/enrichment-document';

@Component({
  selector: 'app-enrichment-table-preview',
  templateUrl: './enrichment-table-preview.component.html',
})
export class EnrichmentTablePreviewComponent {

  @Input() document: EnrichmentDocument;

}
