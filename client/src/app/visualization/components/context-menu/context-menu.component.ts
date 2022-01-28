import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    Output,
    AfterViewInit,
} from '@angular/core';

import { isNil } from 'lodash-es';
import { createPopper, Instance } from '@popperjs/core';
import { Subscription } from 'rxjs';
import { first, filter } from 'rxjs/operators';
import { IdType } from 'vis-network';

import { VisNode } from 'app/interfaces/neo4j.interface';
import {
  AssociatedType,
  Direction,
  GroupRequest,
} from 'app/interfaces/visualization.interface';
import { TooltipComponent } from 'app/shared/components/tooltip.component';
import { TooltipDetails } from 'app/shared/services/tooltip-control-service';

import { ContextMenuControlService } from '../../services/context-menu-control.service';


@Component({
    selector: 'app-context-menu',
    templateUrl: './context-menu.component.html',
    styleUrls: ['./context-menu.component.scss'],
})
export class ContextMenuComponent extends TooltipComponent implements AfterViewInit, OnDestroy, OnChanges {
    @Input() selectedNodeIds: IdType[];
    @Input() selectedEdgeIds: IdType[];
    @Input() selectedClusterNodeData: VisNode[];
    // Expect this to be null if there is not exactly one node selected
    @Input() selectedNodeEdgeLabelData: Map<string, Direction[]>;

    @Output() groupNeighborsWithRelationship: EventEmitter<GroupRequest> = new EventEmitter();
    @Output() removeNodes: EventEmitter<IdType[]> = new EventEmitter();
    @Output() removeEdges: EventEmitter<IdType[]> = new EventEmitter();
    @Output() selectNeighbors: EventEmitter<IdType> = new EventEmitter();
    @Output() pullOutNodeFromCluster: EventEmitter<IdType> = new EventEmitter();
    @Output() openDataSidebar: EventEmitter<boolean> = new EventEmitter();
    @Output() openTypeSidebar: EventEmitter<AssociatedType> = new EventEmitter();

    associatedType = AssociatedType;
    associatedTypeKeys = Object.keys(AssociatedType);

    FADEOUT_STYLE = 'context-menu fade-out';
    DEFAULT_STYLE = 'context-menu';

    groupByRelSubmenuPopper: Instance;
    pullOutNodeSubmenuPopper: Instance;

    contextMenuClass: string;
    subMenuClass: string;

    subMenus: string[] = ['single-node-selection-group-1-submenu', 'pull-out-node-from-cluster-submenu'];

    hideContextMenuSubscription: Subscription;
    updatePopperSubscription: Subscription;

    exactlyOneSelectedEdge: boolean;
    exactlyOneSelectedNode: boolean;
    singleSelection: boolean;
    clusterSelected: boolean;

    constructor(
        private contextMenuControlService: ContextMenuControlService,
    ) {
        super();

        this.tooltipSelector = 'root-menu-' + this.tooltipId;

        this.contextMenuClass = this.DEFAULT_STYLE;
        this.subMenuClass = this.DEFAULT_STYLE;

        this.hideContextMenuSubscription = this.contextMenuControlService.hideTooltip$.subscribe(hideContextMenu => {
            if (hideContextMenu) {
                this.beginContextMenuFade();
            } else {
                this.showTooltip();
            }
        });

        this.updatePopperSubscription = this.contextMenuControlService.updatePopper$.subscribe((details: TooltipDetails) => {
            this.updatePopper(details.posX, details.posY);
        });

        this.exactlyOneSelectedNode = false;
        this.exactlyOneSelectedEdge = false;
        this.singleSelection = false;
        this.clusterSelected = false;
    }

    ngAfterViewInit() {
        super.ngAfterViewInit();

        // Because tooltips have unique identifiers, can't set them to "display: none" in the stylesheet,
        // so instead do it here.
        this.hideTooltip();
    }

    ngOnChanges() {
        this.exactlyOneSelectedNode = this.selectedNodeIds.length === 1;
        this.exactlyOneSelectedEdge = this.selectedEdgeIds.length === 1;
        this.singleSelection = (
            (this.exactlyOneSelectedNode && this.selectedEdgeIds.length === 0) ||
            (this.exactlyOneSelectedEdge && this.selectedNodeIds.length === 0)
        );
        this.clusterSelected = this.selectedClusterNodeData.length > 0;
    }

    ngOnDestroy() {
        super.ngOnDestroy();
        this.hideContextMenuSubscription.unsubscribe();
        this.updatePopperSubscription.unsubscribe();
    }

    showTooltip() {
        // First hide any submenus that might have been open (e.g. a user opened a context menu,
        // hovered over a submenu, then opened a new context menu)
        this.hideAllSubMenus();
        this.tooltip.style.display = 'block';
        this.contextMenuClass = this.DEFAULT_STYLE;
    }

    showSubmenu(contextMenuItemLocator: string, tooltipLocator: string, popper: Instance) {
        const contextMenuItem = document.getElementById(contextMenuItemLocator);
        const tooltip = document.getElementById(tooltipLocator) as HTMLElement;
        tooltip.style.display = 'block';
        this.subMenuClass = this.DEFAULT_STYLE;

        if (!isNil(popper)) {
            popper.destroy();
            popper = null;
        }
        popper = createPopper(contextMenuItem, tooltip, {
            placement: 'right-start',
        });
    }

    showGroupByRelSubMenu() {
        // TODO: It would be very cool if the edges of the hovered relationship were highlighted
        this.hideAllSubMenus();
        this.contextMenuControlService.delayGroupByRel();
        this.contextMenuControlService.showGroupByRelResult$.pipe(
            first(),
            filter(showGroupByRel => showGroupByRel)
        ).subscribe(() => {
            this.showSubmenu(
                'group-by-rel-menu-item-' + this.tooltipId,
                'single-node-selection-group-1-submenu-' + this.tooltipId,
                this.groupByRelSubmenuPopper
            );
        });
    }

    showPullOutNodeSubMenu() {
        this.hideAllSubMenus();
        this.contextMenuControlService.delayPullOutNode();
        this.contextMenuControlService.showPullOutNodeResult$.pipe(
            first(),
            filter(showPullOutNode => showPullOutNode)
        ).subscribe(() => {
            this.showSubmenu(
                'pull-out-node-from-cluster-menu-item-' + this.tooltipId,
                'pull-out-node-from-cluster-submenu-' + this.tooltipId,
                this.pullOutNodeSubmenuPopper
            );
        });
    }

    hideTooltip() {
        this.tooltip.style.display = 'none';
        this.hideAllSubMenus();
    }

    hideSubmenu(tooltipSelector: string) {
        const tooltip = document.getElementById(tooltipSelector) as HTMLElement;
        tooltip.style.display = 'none';
    }

    hideAllSubMenus() {
        this.contextMenuControlService.interruptGroupByRel();
        this.contextMenuControlService.interruptPullOutNode();
        this.subMenus.forEach(subMenu => {
            const tooltip = document.getElementById(`${subMenu}-${this.tooltipId}`) as HTMLElement;
            tooltip.style.display = 'none';
        });
    }

    beginContextMenuFade() {
        this.contextMenuClass = this.FADEOUT_STYLE;
        this.beginSubmenuFade();
        setTimeout(() => {
            this.hideTooltip();
        }, 100);
    }

    beginSubmenuFade() {
        this.subMenuClass = this.FADEOUT_STYLE;
    }

    mouseLeaveNodeRow() {
        // Interrupt showing the submenu if the user hovers away from a node
        this.contextMenuControlService.interruptGroupByRel();
    }

    requestGroupByRelationship(rel: string, direction: Direction) {
        // If this is the last possible label, update the submenu display so it is hidden
        if (this.selectedNodeEdgeLabelData.size === 1) {
            this.hideSubmenu('single-node-selection-group-1-submenu-' + this.tooltipId);
        }
        this.groupNeighborsWithRelationship.emit({
            relationship: rel,
            node: this.selectedNodeIds[0],
            direction,
        });
    }

    requestPullNodeFromCluster(clusteredNode: VisNode) {
        // If this is the last node in the cluster, update the submenu display so it is hidden
        if (this.selectedClusterNodeData.length === 1) {
            this.hideSubmenu('pull-out-node-from-cluster-submenu-' + this.tooltipId);
        }
        this.pullOutNodeFromCluster.emit(clusteredNode.id);
    }

    requestEdgeRemoval() {
        this.removeEdges.emit(this.selectedEdgeIds);
        this.beginContextMenuFade();
    }

    requestNodeRemoval() {
        this.removeNodes.emit(this.selectedNodeIds);
        this.beginContextMenuFade();
    }

    requestNeighborSelection() {
        if (this.selectedNodeIds.length !== 1) {
            alert('Can only select neighbor nodes if exactly one node is selected!');
            return;
        }
        this.selectNeighbors.emit(this.selectedNodeIds[0]);
        this.beginContextMenuFade();
    }

    requestDataSidenav() {
        this.openDataSidebar.emit(true);
        this.hideTooltip();
    }

    requestTypeSidenav(type: AssociatedType) {
        this.openTypeSidebar.emit(type);
        this.hideTooltip();
    }
}
