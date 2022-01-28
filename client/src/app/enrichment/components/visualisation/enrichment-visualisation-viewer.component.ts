import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { Subscription } from 'rxjs';

import { ModuleAwareComponent, ModuleProperties } from 'app/shared/modules';
import { BackgroundTask } from 'app/shared/rxjs/background-task';
import { FilesystemObject } from 'app/file-browser/models/filesystem-object';
import { EnrichmentVisualisationService, EnrichWithGOTermsResult } from 'app/enrichment/services/enrichment-visualisation.service';

import { EnrichmentService } from '../../services/enrichment.service';


@Component({
  selector: 'app-enrichment-visualisation-viewer',
  templateUrl: './enrichment-visualisation-viewer.component.html',
  styleUrls: ['./enrichment-visualisation-viewer.component.scss'],
  providers: [EnrichmentVisualisationService, EnrichmentService]
})
export class EnrichmentVisualisationViewerComponent implements OnInit, ModuleAwareComponent {

  constructor(protected readonly route: ActivatedRoute,
              readonly enrichmentService: EnrichmentVisualisationService) {
    this.enrichmentService.fileId = this.route.snapshot.params.file_id || '';
    this.loadingData = true;
  }


  @Output() modulePropertiesChange = new EventEmitter<ModuleProperties>();

  object: FilesystemObject;
  groups = [
    'Biological Process',
    'Molecular Function',
    'Cellular Component'
  ];
  data = new Map<string, undefined | EnrichWithGOTermsResult[]>([
    ['BiologicalProcess', undefined],
    ['MolecularFunction', undefined],
    ['CellularComponent', undefined]
  ]);

  loadingData: boolean;

  loadTask: BackgroundTask<string, EnrichWithGOTermsResult[]>;

  loadSubscription: Subscription;

  // preserve sort for keyvalue pipe
  originalOrder(a, b) {
    return 0;
  }

  ngOnInit() {
    this.enrichmentService.loadTaskMetaData.results$.subscribe(({result}) => {
      this.object = result;
      this.emitModuleProperties();
    });
    this.loadTask = new BackgroundTask((analysis) =>
      this.enrichmentService.enrichWithGOTerms(analysis),
    );

    this.loadSubscription = this.loadTask.results$.subscribe(({result}) => {
      const data = result.sort((a, b) => a['p-value'] - b['p-value']);
      this.data.forEach((value, key, map) =>
        map.set(key, data.filter(({goLabel}) => goLabel.includes(key)) as EnrichWithGOTermsResult[])
      );
      this.loadingData = false;
    });
    this.enrichmentService.load.subscribe((data) => {
      this.loadTask.update('fisher');
    });
  }

  // End of changing enrichment params section.
  emitModuleProperties() {
    let title = 'Statistical Enrichment';
    if (this.object) {
      title += ` for ${this.object.filename}`;
    }
    this.modulePropertiesChange.emit({
      title,
      fontAwesomeIcon: 'chart-bar',
    });
  }
}


export interface EnrichmentVisualisationParameters {
  genes: any;
  domains?: any;
  organism?: any;
}

export interface EnrichmentVisualisationData {
  parameters: EnrichmentVisualisationParameters;
}
