import { Component, Input } from '@angular/core';

import { SidenavNodeEntity } from 'app/interfaces';

@Component({
    selector: 'app-sidenav-node-view',
    templateUrl: './sidenav-node-view.component.html',
    styleUrls: ['./sidenav-node-view.component.scss']
})
export class SidenavNodeViewComponent {
    @Input() legend: Map<string, string[]>;
    @Input() nodeEntity: SidenavNodeEntity;

    constructor() { }
}
