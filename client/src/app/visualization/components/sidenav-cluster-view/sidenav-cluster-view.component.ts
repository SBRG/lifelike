import { Component, EventEmitter, Input, Output } from '@angular/core';

import { NewClusterSnippetsPageRequest, SidenavClusterEntity } from 'app/interfaces';

@Component({
    selector: 'app-sidenav-cluster-view',
    templateUrl: './sidenav-cluster-view.component.html',
    styleUrls: ['./sidenav-cluster-view.component.scss']
})
export class SidenavClusterViewComponent {
    @Output() requestNewPageEmitter: EventEmitter<NewClusterSnippetsPageRequest>;
    @Input() clusterEntity: SidenavClusterEntity;
    @Input() isNewEntity: boolean;
    @Input() error: Error;
    @Input() legend: Map<string, string[]>;

    constructor() {
        this.requestNewPageEmitter = new EventEmitter<NewClusterSnippetsPageRequest>();
    }

    requestPage(request: NewClusterSnippetsPageRequest) {
        this.requestNewPageEmitter.emit(request);
    }
}
