import {
  ComponentFactory,
  ComponentFactoryResolver,
  ComponentRef,
  Injectable,
  Injector,
  StaticProvider,
  Type,
  ViewContainerRef,
} from '@angular/core';
import {
  ActivatedRoute,
  ActivatedRouteSnapshot,
  NavigationExtras,
  Router,
  RoutesRecognized,
  UrlTree,
} from '@angular/router';
import { moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';

import { filter } from 'rxjs/operators';
import { BehaviorSubject, Subscription } from 'rxjs';
import { cloneDeep } from 'lodash-es';

import { ModuleAwareComponent, ModuleProperties } from './modules';
import {
  TabData,
  WorkspaceSessionLoader,
  WorkspaceSessionService,
} from './services/workspace-session.service';

export interface TabDefaults {
  title: string;
  fontAwesomeIcon: string;
}


/**
 * Manages the lifecycle of a dynamically instantiated component.
 */
export class Container<T> {
  private createdComponentRef: ComponentRef<T> = null;
  private viewContainerRef: ViewContainerRef;

  constructor(private readonly tab: Tab,
              private readonly injector: Injector,
              private componentFactoryResolver: ComponentFactoryResolver,
              readonly component: Type<T>) {
  }

  get attached(): boolean {
    return this.viewContainerRef != null;
  }

  /**
   * Create the component if necessary and attach it to the given ref. If
   * this component has already been attached to a ref, then an error
   * will be raised.
   * @param viewContainerRef the ref
   */
  attach(viewContainerRef: ViewContainerRef) {
    if (this.viewContainerRef) {
      throw new Error('already attached to a ViewContainerRef');
    }
    this.viewContainerRef = viewContainerRef;
    viewContainerRef.insert(this.componentRef.hostView);
  }

  /**
   * Detach the component from the associated ref, if there
   * is one.
   */
  detach() {
    if (this.viewContainerRef) {
      this.viewContainerRef.detach(0);
      this.viewContainerRef = null;
    }
  }

  /**
   * Get a component ref if one has already been created.
   */
  get lazyComponentRef(): ComponentRef<T> | undefined {
    return this.createdComponentRef;
  }

  /**
   * Get a component ref, creating it if necessary.
   */
  get componentRef(): ComponentRef<T> {
    if (!this.createdComponentRef) {
      const factory: ComponentFactory<T> = this.componentFactoryResolver.resolveComponentFactory(this.component);
      this.createdComponentRef = factory.create(this.injector);
      const instance = this.createdComponentRef.instance as ModuleAwareComponent;
      const subscriptions: Subscription[] = [];
      if (instance.modulePropertiesChange) {
        subscriptions.push(instance.modulePropertiesChange.subscribe(properties => {
          this.tab.queuePropertyChange(properties);
        }));
      }
      this.createdComponentRef.onDestroy(() => {
        this.createdComponentRef = null;
        this.viewContainerRef = null;
        for (const subscription of subscriptions) {
          subscription.unsubscribe();
        }
      });
    }
    return this.createdComponentRef;
  }

  /**
   * Destroy the created component ref if it has been created.
   */
  destroy() {
    this.detach();
    if (this.createdComponentRef) {
      this.createdComponentRef.destroy();
      this.createdComponentRef = null;
      this.viewContainerRef = null;
    }
  }
}

/**
 * Represents a tab with a title and possibly a component inside.
 */
export class Tab {
  workspaceManager: WorkspaceManager;
  url: string;
  defaultsSet = false;
  title = 'New Tab';
  fontAwesomeIcon: string = null;
  badge: string = null;
  loading = false;
  component: Type<any>;
  providers: StaticProvider[] = [];
  container: Container<any>;

  pendingProperties: ModuleProperties | undefined;

  constructor(private readonly injector: Injector,
              private readonly componentFactoryResolver: ComponentFactoryResolver) {
    this.workspaceManager = this.injector.get<WorkspaceManager>(WorkspaceManager);
  }

  get absoluteUrl(): string {
    return new URL(this.url.replace(/^\/+/, '/'), new URL(window.location.href)).href;
  }

  queuePropertyChange(properties: ModuleProperties) {
    this.pendingProperties = cloneDeep(properties);
  }

  applyPendingChanges() {
    if (this.pendingProperties) {
      this.title = this.pendingProperties.title;
      this.fontAwesomeIcon = this.pendingProperties.fontAwesomeIcon;
      this.badge = this.pendingProperties.badge;
      this.loading = !!this.pendingProperties.loading;
      this.pendingProperties = null;
      this.workspaceManager.save();
    }
  }

  /**
   * Load the given component into this tab at some point in the future.
   * @param component the component
   * @param providers optional providers for the injector
   */
  replaceComponent(component: Type<any>, providers: StaticProvider[] = []) {
    this.destroy();

    this.container = new Container<any>(
      this,
      Injector.create({
        parent: this.injector,
        providers,
      }),
      this.componentFactoryResolver,
      component,
    );
  }

  /**
   * Attach the tab's component to the given ref if there is a component. If
   * this component has already been attached to a ref, then an error
   * will be raised.
   * @param viewContainerRef the ref
   */
  attach(viewContainerRef: ViewContainerRef) {
    if (this.container) {
      this.container.attach(viewContainerRef);
    }
  }

  /**
   * Detach this tab from its view ref, if any.
   */
  detach() {
    if (this.container) {
      this.container.detach();
    }
  }

  /**
   * Destroy the component if it has been existed and clear the
   * component on this tab.
   */
  destroy() {
    if (this.container) {
      this.container.destroy();
      this.container = null;
    }
  }

  /**
   * Get the underlying component, if it has been created.
   */
  getComponent(): any | undefined {
    const componentRef = this.container ? this.container.lazyComponentRef : null;
    return componentRef ? componentRef.instance : null;
  }
}

/**
 * Represents a pane that has a collection of tabs. A pane might
 * be part of a split view or a pane might be a sidebar window.
 */
export class Pane {
  /**
   * Percentage width of the pane.
   */
  size: number | undefined;

  /**
   * The tabs that are a part of this pane.
   */
  readonly tabs: Tab[] = [];

  /**
   * A list of active tabs in the past, where last entry is the current
   * active tab. Sets are kept in insertion order and we keep a list of
   * active tabs so that when a tab is closed, we know what the previous
   * tab was so we can switch to it.
   */
  readonly activeTabHistory: Set<Tab> = new Set();

  constructor(readonly id: string,
              private readonly injector: Injector) {
  }

  applyPendingChanges() {
    for (const tab of this.tabs) {
      tab.applyPendingChanges();
    }
  }

  /**
   * Get the current active tab, if any.
   */
  get activeTab(): Tab | undefined {
    let active: Tab = null;
    for (const tab of this.activeTabHistory.values()) {
      active = tab;
    }
    return active;
  }

  /**
   * Set the given tab to be the active tab.
   * @param tab the tab to make active
   */
  set activeTab(tab: Tab) {
    if (tab != null) {
      this.activeTabHistory.delete(tab);
      this.activeTabHistory.add(tab);
    }
  }

  /**
   * Get the active tab or created an empty tab if there is none.
   */
  getActiveTabOrCreate(): Tab {
    const tab = this.activeTab;
    if (tab) {
      return tab;
    }
    if (this.tabs.length) {
      this.activeTab = this.tabs[0];
      return this.activeTab;
    }
    return this.createTab();
  }

  /**
   * Create a new tab and add it to this pane.
   */
  createTab(): Tab {
    const tab = new Tab(
      this.injector,
      this.injector.get<ComponentFactoryResolver>(ComponentFactoryResolver as any),
    );
    this.tabs.push(tab);
    this.activeTab = tab;
    return tab;
  }

  /**
   * Remove the given tab from this pane.
   * @param tab the tab
   */
  deleteTab(tab: Tab): boolean {
    for (let i = 0; i < this.tabs.length; i++) {
      if (this.tabs[i] === tab) {
        this.tabs.splice(i, 1);
        this.activeTabHistory.delete(tab);
        return true;
      }
    }
    return false;
  }

  /**
   * Remove the currently active tab.
   */
  deleteActiveTab(): boolean {
    const activeTab = this.activeTab;
    if (this.activeTab) {
      return this.deleteTab(activeTab);
    }
    return false;
  }

  /**
   * Called for the previous pane when a tab is moved from one pane to another.
   * @param tab the tab that was moved
   */
  handleTabMoveFrom(tab: Tab) {
    tab.detach();
    this.activeTabHistory.delete(tab);
  }

  /**
   * Called for the new pane when a tab is moved from one pane to another.
   * @param tab the tab that was moved
   */
  handleTabMoveTo(tab: Tab) {
    this.activeTabHistory.add(tab);
  }

  /**
   * Destroy all tabs and unload their components.
   */
  destroy() {
    for (const tab of this.tabs) {
      this.deleteTab(tab);
    }
  }
}

/**
 * Manages a set of panes.
 */
export class PaneManager {
  panes: Pane[] = [];

  constructor(private readonly injector: Injector) {
  }

  /**
   * Create a new pane.
   * @param id the pane ID that must be unique
   */
  create(id: string): Pane {
    for (const existingPane of this.panes) {
      if (existingPane.id === id) {
        throw new Error(`pane ${existingPane.id} already created`);
      }
    }
    const pane = new Pane(id, this.injector);
    this.panes.push(pane);
    return pane;
  }

  /**
   * Get the pane by the given ID.
   * @param id the ID
   */
  get(id: string): Pane | undefined {
    for (const pane of this.panes) {
      if (pane.id === id) {
        return pane;
      }
    }
    return null;
  }

  /**
   * Get the pane by the given ID or create the pane if it doesn't exist.
   * @param id the ID
   */
  getOrCreate(id: string): Pane {
    const pane = this.get(id);
    if (pane) {
      return pane;
    }
    return this.create(id);
  }

  /**
   * Get the first pane or created one if one doesn't exist.
   */
  getFirstOrCreate() {
    const it = this.panes.values().next();
    return !it.done ? it.value : this.create('left');
  }

  /**
   * Remove the given pane.
   * @param pane the pane
   */
  delete(pane: Pane): boolean {
    for (let i = 0; i < this.panes.length; i++) {
      if (this.panes[i] === pane) {
        this.panes.splice(i, 1);
        pane.destroy();
        return true;
      }
    }
    return false;
  }

  /**
   * Delete all panes.
   */
  clear() {
    for (const pane of this.panes) {
      this.delete(pane);
    }
  }

  /**
   * Get all the tabs within all the panes.
   */
  * allTabs(): IterableIterator<{ pane: Pane, tab: Tab }> {
    for (const pane of this.panes) {
      for (const tab of pane.tabs) {
        yield {
          pane,
          tab,
        };
      }
    }
  }

  applyPendingChanges() {
    for (const pane of this.panes) {
      pane.applyPendingChanges();
    }
  }
}

@Injectable({
  providedIn: 'root',
})
export class WorkspaceManager {
  panes: PaneManager;
  readonly workspaceUrl = '/workspaces/local';
  focusedPane: Pane | undefined;
  private interceptNextRoute = false;
  panes$ = new BehaviorSubject<Pane[]>([]);
  private loaded = false;

  constructor(private readonly router: Router,
              private readonly injector: Injector,
              private readonly sessionService: WorkspaceSessionService) {
    this.panes = new PaneManager(injector);
    this.hookRouter();
    this.emitEvents();
  }

  isWithinWorkspace() {
    return this.router.url === this.workspaceUrl;
  }

  private hookRouter() {
    // Intercept changing routes and redirect to our workspace
    this.router.events
      .pipe(filter(event => event instanceof RoutesRecognized))
      .subscribe((event: RoutesRecognized) => {
        // Flag set to true if this route navigation was started by [appLink]
        if (this.interceptNextRoute) {
          this.interceptNextRoute = false;

          if (this.router.url !== this.workspaceUrl) {
            // If we're currently not in the workspace view, then navigate to
            // to the route in full size
            // TODO: Do we have to handle the 'extras' argument from navigateByUrl()?
            this.router.navigateByUrl(event.url);
          } else {
            // TODO: Support nested routes
            const routeSnapshot: ActivatedRouteSnapshot = this.getDeepestChild(event.state.root);

            const pane = this.focusedPane || this.panes.getFirstOrCreate();
            const tab = pane.getActiveTabOrCreate();

            // We are using undocumented API to create an ActivatedRoute that carries the parameters
            // from the URL -- this part is a little hacky
            // @ts-ignore
            const activatedRoute = new ActivatedRoute(new BehaviorSubject(routeSnapshot.url),
              new BehaviorSubject(routeSnapshot.params), new BehaviorSubject(routeSnapshot.queryParams),
              new BehaviorSubject(routeSnapshot.fragment), new BehaviorSubject(routeSnapshot.data),
              routeSnapshot.outlet, routeSnapshot.component, routeSnapshot);
            activatedRoute.snapshot = routeSnapshot;

            if (!tab.defaultsSet) {
              // Only change if we didn't have a tab loaded already in case of defaults
              tab.title = routeSnapshot.data.title || 'Module';
              tab.fontAwesomeIcon = routeSnapshot.data.fontAwesomeIcon || null;
            } else {
              tab.defaultsSet = false;
            }
            tab.url = '/' +
              routeSnapshot.pathFromRoot.map(child => child.url.map(segment => segment.toString()).join('/')).join('/') +
              (routeSnapshot.queryParams ? `?${getQueryString(routeSnapshot.queryParams)}` : '') +
              (routeSnapshot.fragment ? `#${routeSnapshot.fragment}` : '');
            // TODO: Component may be a string
            tab.replaceComponent(routeSnapshot.component as Type<any>, [{
              // Provide our custom ActivatedRoute with the params
              provide: ActivatedRoute,
              useValue: activatedRoute,
            }]);

            this.save();

            // Since we are intercepting routing, make sure we don't leave the workspace
            this.router.navigateByUrl(this.workspaceUrl, {replaceUrl: true});

            // Update everything
            this.emitEvents();
          }
        }
      });
  }

  moveTab(from: Pane, fromIndex: number, to: Pane, toIndex: number) {
    if (from === to) {
      moveItemInArray(from.tabs, fromIndex, toIndex);
    } else {
      const tab = from.tabs[fromIndex];
      transferArrayItem(from.tabs, to.tabs, fromIndex, toIndex);
      from.handleTabMoveFrom(tab);
      to.handleTabMoveTo(tab);
    }
    this.save();
    this.emitEvents();
  }

  openTabByUrl(pane: Pane | string,
               url: string | UrlTree,
               extras?: NavigationExtras & WorkspaceNavigationExtras,
               tabDefaults?: TabDefaults): Promise<boolean> {
    if (typeof pane === 'string') {
      pane = this.panes.getOrCreate(pane);
    }
    this.focusedPane = pane;
    const tab = pane.createTab();
    if (tabDefaults) {
      tab.title = tabDefaults.title;
      tab.fontAwesomeIcon = tabDefaults.fontAwesomeIcon;
      tab.defaultsSet = true;
    }
    return this.navigateByUrl({url, extras});
  }

  navigateByUrl(navigationData: NavigationData): Promise<boolean> {
    let extras = navigationData.extras || {};

    const withinWorkspace = this.isWithinWorkspace();

    if (withinWorkspace) {
      let targetPane = this.focusedPane || this.panes.getFirstOrCreate();

      if (extras.newTab) {
        if (extras.sideBySide) {
          let sideBySidePane = null;
          for (const otherPane of this.panes.panes) {
            if (targetPane.id !== otherPane.id) {
              sideBySidePane = otherPane;
              break;
            }
          }

          if (sideBySidePane == null) {
            if (targetPane.id === 'left') {
              targetPane = this.panes.create('right');
            } else {
              targetPane = this.panes.create('left');
            }
          } else {
            targetPane = sideBySidePane;
          }
        }

        if (extras.preferPane) {
          const preferredPane = this.panes.get(extras.preferPane);
          if (preferredPane) {
            targetPane = preferredPane;
          }
        }

        if (extras.matchExistingTab != null) {
          let foundTab = false;

          for (const tab of targetPane.tabs) {
            if (tab.url.match(extras.matchExistingTab)) {
              targetPane.activeTab = tab;
              foundTab = true;

              // This mechanism allows us to update an existing tab in a one-way data coupling
              if (extras.shouldReplaceTab != null) {
                const component = tab.getComponent();
                if (component != null) {
                  if (!extras.shouldReplaceTab(component)) {
                    return;
                  }
                }
              }

              break;
            }
          }

          if (!foundTab) {
            targetPane.createTab();
          }
        } else {
          targetPane.createTab();
        }

        this.focusedPane = targetPane;
      }

      this.interceptNextRoute = true;
    }

    if (!withinWorkspace && extras.forceWorkbench) {
        return this.router.navigateByUrl(this.workspaceUrl).then(() => {
          return new Promise((accept, reject) => {
            const navigationArray = [];
            // If the works only together with parent (like statistical enrichment and enrichment table)
            // then force the workbench, open the parent on the left and 'child' on the right
            if (extras.openParentFirst && extras.parentAddress) {
              // If opening parent on the left, make sure that child will open on the right
              const parentExtras = {
                ...extras,
                openParentFirst: false,
                preferPane: 'left',
                matchExistingTab: extras.parentAddress.toString(),
                shouldReplaceTab: true
              };
              extras = {
                ...extras,
                openParentFirst: false,
                preferPane: 'right'
              };
              navigationArray.push({url: extras.parentAddress, extras: parentExtras});
            }
            navigationArray.push({url: navigationData.url, extras});
            this.navigateByUrls(navigationArray).then(accept, reject);
          });
        });
    } else {
      return this.router.navigateByUrl(navigationData.url, extras);
    }
  }

  navigateByUrls(navigationData: NavigationData[]): Promise<boolean> {
    return new Promise((accept, reject) => {
      navigationData.forEach((navData) => {
        const extras = navData.extras || {};
        // We need a delay because things break if we do it too quickly
        setTimeout(() => {
          this.navigateByUrl({url: navData.url, extras}).then(accept, reject);
        }, 10);
      });
    });

  }

  navigate(commands: any[], extras: NavigationExtras & WorkspaceNavigationExtras = {skipLocationChange: false}): Promise<boolean> {
    return this.navigateByUrl({url: this.router.createUrlTree(commands, extras), extras});
  }

  emitEvents(): void {
    this.panes$.next(this.buildPanesSnapshot());
  }

  initialLoad() {
    if (!this.loaded) {
      this.loaded = true;
      this.load();
    }
  }

  load() {
    const parent = this;
    const tasks = [];

    if (this.sessionService.load(new class implements WorkspaceSessionLoader {
      createPane(id: string, options): void {
        tasks.push(() => {
          const pane = parent.panes.create(id);
          pane.size = options.size;
        });
      }

      loadTab(id: string, data: TabData): void {
        tasks.push(() => {
          parent.openTabByUrl(id, data.url, null, {
            title: data.title,
            fontAwesomeIcon: data.fontAwesomeIcon,
          });
        });
      }

      setPaneActiveTabHistory(id: string, indices: number[]): void {
        tasks.push(() => {
          const pane = parent.panes.get(id);
          const activeTabHistory = pane.activeTabHistory;
          activeTabHistory.clear();
          indices.forEach(index => {
            activeTabHistory.add(pane.tabs[index]);
          });
        });
      }
    }())) {
      this.panes.clear();
      tasks.reduce((previousTask, task) => {
        return previousTask.then(task);
      }, Promise.resolve());
    } else {
      const leftPane = this.panes.create('left');
      this.panes.create('right');
      this.openTabByUrl(leftPane, '/projects');
    }
  }

  save() {
    this.sessionService.save(this.panes.panes);
  }

  shouldConfirmUnload(): { pane: Pane, tab: Tab } | undefined {
    for (const {pane, tab} of this.panes.allTabs()) {
      if (this.shouldConfirmTabUnload(tab)) {
        return {pane, tab};
      }
    }
    return null;
  }

  shouldConfirmTabUnload(tab: Tab) {
    const component = tab.getComponent();
    return !!(component && component.shouldConfirmUnload && component.shouldConfirmUnload());
  }

  applyPendingChanges() {
    this.panes.applyPendingChanges();
  }

  private buildPanesSnapshot(): Pane[] {
    return this.panes.panes;
  }

  private getDeepestChild(snapshot: ActivatedRouteSnapshot) {
    if (snapshot.children.length) {
      return this.getDeepestChild(snapshot.children[0]);
    } else {
      return snapshot;
    }
  }
}

export interface WorkspaceNavigationExtras {
  preferPane?: string;
  preferStartupPane?: string;
  newTab?: boolean;
  sideBySide?: boolean;
  matchExistingTab?: string | RegExp;
  shouldReplaceTab?: (component: any) => boolean;
  forceWorkbench?: boolean;
  openParentFirst?: boolean;
  parentAddress?: UrlTree;
}

// Grouped the arguments required by the navigateByUrl function in order to simplify handling navigateByUrls
// of missing extras in navigateByUrls
export interface NavigationData {
  url: string | UrlTree;
  extras?: NavigationExtras & WorkspaceNavigationExtras;
}

function getQueryString(params: { [key: string]: string }) {
  return Object.entries(params).map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value)).join('&');
}
