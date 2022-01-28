import { Component } from '@angular/core';

import { Observable } from 'rxjs';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

import { MetaDataService } from 'app/shared/services/metadata.service';
import { BuildInfo } from 'app/interfaces';

@Component({
  selector: 'app-version-dialog',
  templateUrl: './app-version-dialog.component.html',
})
export class AppVersionDialogComponent {

  readonly buildInfo$: Observable<BuildInfo>;

  constructor(
    public readonly modal: NgbActiveModal,
    private readonly metadataService: MetaDataService,
  ) {
    this.buildInfo$ = this.metadataService.getBuildInfo();
  }

  close(): void {
    this.modal.close();
  }
}
