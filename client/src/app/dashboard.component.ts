import { Component } from '@angular/core';

import { Observable } from 'rxjs';

import { MetaDataService } from 'app/shared/services/metadata.service';
import { BuildInfo } from 'app/interfaces';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent {
  readonly buildInfo$: Observable<BuildInfo>;

  constructor(private readonly metadataService: MetaDataService) {
    this.buildInfo$ = this.metadataService.getBuildInfo();
  }
}
