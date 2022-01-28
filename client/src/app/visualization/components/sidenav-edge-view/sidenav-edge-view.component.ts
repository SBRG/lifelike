import { Component, EventEmitter, Input, Output } from '@angular/core';

import { SidenavEdgeEntity, NewEdgeSnippetsPageRequest } from 'app/interfaces';

@Component({
    selector: 'app-sidenav-edge-view',
    templateUrl: './sidenav-edge-view.component.html',
    styleUrls: ['./sidenav-edge-view.component.scss']
})
export class SidenavEdgeViewComponent {
    @Output() requestNewPageEmitter: EventEmitter<NewEdgeSnippetsPageRequest>;
    @Input() edgeEntity: SidenavEdgeEntity;
    @Input() isNewEntity: boolean;
    @Input() error: Error;
    @Input() legend: Map<string, string[]>;

    constructor() {
        this.requestNewPageEmitter = new EventEmitter<NewEdgeSnippetsPageRequest>();
    }

    requestPage(request: NewEdgeSnippetsPageRequest) {
        this.requestNewPageEmitter.emit(request);
    }
}
