import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

import { configureTestSuite } from 'ng-bullet';
import { MockComponents } from 'ng-mocks';
import { of } from 'rxjs';
import { DataSet } from 'vis-data';

import {
    ExpandNodeRequest,
    GraphNode,
    GraphRelationship,
    Neo4jResults,
    VisEdge,
    VisNode,
    NewEdgeSnippetsPageRequest,
    EdgeConnectionData,
    NewClusterSnippetsPageRequest,
    DuplicateEdgeConnectionData,
} from 'app/interfaces';
import { RootStoreModule } from 'app/root-store';
import { GraphSearchFormComponent } from 'app/search/components/graph-search-form.component';
import { SharedModule } from 'app/shared/shared.module';
import { SNIPPET_PAGE_LIMIT } from 'app/shared/constants';
import { LegendService } from 'app/shared/services/legend.service';

import { VisualizationComponent } from './visualization.component';
import { VisualizationService } from '../../services/visualization.service';
import { VisualizationCanvasComponent } from '../../components/visualization-canvas/visualization-canvas.component';

describe('VisualizationComponent', () => {
    let fixture: ComponentFixture<VisualizationComponent>;
    let instance: VisualizationComponent;

    let legendService: LegendService;

    let mockGraphNode: GraphNode;
    let mockGraphRelationship: GraphRelationship;
    let mockNeo4jResults: Neo4jResults;
    let mockNewEdgeSnippetsPageRequest: NewEdgeSnippetsPageRequest;
    let mockNewClusterSnippetsPageRequest: NewClusterSnippetsPageRequest;

    configureTestSuite(() => {
        TestBed.configureTestingModule({
            imports: [
                RootStoreModule,
                RouterTestingModule,
                SharedModule,
                BrowserAnimationsModule
            ],
            declarations: [
                VisualizationComponent,
                MockComponents(
                    GraphSearchFormComponent,
                    VisualizationCanvasComponent,
                ),
            ],
            providers: [VisualizationService],
        });
    });

    beforeEach(() => {
        // Mock Neo4j data
        mockGraphNode = {
            id: 1,
            label: 'Mock Node',
            data: {},
            subLabels: ['Mock Node'],
            displayName: 'Mock Node 1',
            domainLabels: [],
            entityUrl: null,
        };
        mockGraphRelationship = {
            id: 1,
            label: 'Mock Edge',
            data: { description: 'Mock Edge'},
            to: 1,
            from: 2,
            toLabel: 'Mock Node',
            fromLabel: 'Mock Node',
        };
        mockNeo4jResults = {
            nodes: [mockGraphNode],
            edges: [mockGraphRelationship],
        };

        mockNewEdgeSnippetsPageRequest = {
            page: 1,
            limit: SNIPPET_PAGE_LIMIT,
            queryData: {
                from: 1,
                to: 2,
                fromLabel: 'MockNode1',
                toLabel: 'MockNode2',
                label: 'Mock Association',
            } as EdgeConnectionData,
        };

        mockNewClusterSnippetsPageRequest = {
            page: 1,
            limit: SNIPPET_PAGE_LIMIT,
            queryData: [
                {
                    originalFrom: 1,
                    originalTo: 2,
                    from: 101,
                    to: 102,
                    fromLabel: 'MockNode1',
                    toLabel: 'MockNode2',
                    label: 'Mock Association',
                }
            ] as DuplicateEdgeConnectionData[],
        };

        fixture = TestBed.createComponent(VisualizationComponent);
        instance = fixture.debugElement.componentInstance;
        legendService = fixture.debugElement.injector.get(LegendService);

        spyOn(legendService, 'getAnnotationLegend').and.returnValue(of({
            gene: {
                color: '#673ab7',
                label: 'gene',
            },
            chemical: {
                color: '#4caf50',
                label: 'chemical',
            },
            disease: {
                color: '#ff9800',
                label: 'disease',
            }
        }));

        instance.legend.set('Mock Node', ['#FFFFFF', '#FFFFFF']);
        instance.networkGraphData = instance.setupInitialProperties(mockNeo4jResults);

        fixture.detectChanges();
    });

    it('should create', () => {
        expect(fixture).toBeTruthy();
    });

    it('convertNodeToVisJSFormat should convert a graph node to vis js format', () => {
        const convertedMockNode = instance.convertNodeToVisJSFormat(mockGraphNode);
        expect(convertedMockNode).toEqual({
            ...mockGraphNode,
            expanded: false,
            primaryLabel: mockGraphNode.label,
            font: {
                color: instance.legend.get(mockGraphNode.label)[0],
            },
            color: {
                background: '#FFFFFF',
                border: instance.legend.get(mockGraphNode.label)[1],
                hover: {
                    background: '#FFFFFF',
                    border: instance.legend.get(mockGraphNode.label)[1],
                },
                highlight: {
                    background: '#FFFFFF',
                    border: instance.legend.get(mockGraphNode.label)[1],
                }
            },
            label: mockGraphNode.displayName.length > 64 ? mockGraphNode.displayName.slice(0, 64) + '...'  : mockGraphNode.displayName,
        });
    });

    it('convertEdgeToVisJSFormat should convert an edge node to vis js format', () => {
        const convertedMockEdge = instance.convertEdgeToVisJSFormat(mockGraphRelationship);
        expect(convertedMockEdge).toEqual({
            ...mockGraphRelationship,
            label: mockGraphRelationship.data.description,
            arrows: 'to',
            color: {
                color: '#0c8caa',
            }
        });
    });

    it('convertToVisJSFormat should convert neo4j query results to vis js format', () => {
        const convertedMockNode = instance.convertNodeToVisJSFormat(mockGraphNode);
        const convertedMockEdge = instance.convertEdgeToVisJSFormat(mockGraphRelationship);
        const convertedNeo4jResults = instance.convertToVisJSFormat(mockNeo4jResults);

        expect(convertedNeo4jResults).toEqual({
            nodes: [convertedMockNode],
            edges: [convertedMockEdge],
        });
    });

    it('should call expandNode service when child requests a node to be expanded', () => {
        const expandNodeSpy = spyOn(instance, 'expandNode');
        const visualizationCanvasComponentMock = fixture.debugElement.query(
            By.directive(VisualizationCanvasComponent)
        ).componentInstance as VisualizationCanvasComponent;
        const mockExpandNodeRequest = {
            nodeId: 1,
            filterLabels: ['Chemicals', 'Diseases', 'Genes']
        } as ExpandNodeRequest;

        visualizationCanvasComponentMock.expandNode.emit(mockExpandNodeRequest);

        expect(expandNodeSpy).toHaveBeenCalledWith(mockExpandNodeRequest);
    });

    it('should emit getSnippetsForEdge subject when child requests snippets for edge', () => {
        const getSnippetsFromEdgeSpy = spyOn(instance.getEdgeSnippetsSubject, 'next');
        const visualizationCanvasComponentMock = fixture.debugElement.query(
            By.directive(VisualizationCanvasComponent)
        ).componentInstance as VisualizationCanvasComponent;

        visualizationCanvasComponentMock.getSnippetsForEdge.emit(mockNewEdgeSnippetsPageRequest);

        expect(getSnippetsFromEdgeSpy).toHaveBeenCalledWith(mockNewEdgeSnippetsPageRequest);
    });

    it('should call getClusterData when child requests data for cluster', () => {
        const getClusterGraphDataSpy = spyOn(instance.getClusterSnippetsSubject, 'next');
        const visualizationCanvasComponentMock = fixture.debugElement.query(
            By.directive(VisualizationCanvasComponent)
        ).componentInstance as VisualizationCanvasComponent;

        visualizationCanvasComponentMock.getSnippetsForCluster.emit(mockNewClusterSnippetsPageRequest);

        expect(getClusterGraphDataSpy).toHaveBeenCalledWith(mockNewClusterSnippetsPageRequest);
    });

    it('updateCanvasWithSingleNode should clear the canvas and add a single node', () => {
        instance.nodes = new DataSet<VisNode | GraphNode>(instance.networkGraphData.nodes);
        instance.edges = new DataSet<VisEdge | GraphRelationship>(instance.networkGraphData.edges);

        expect(instance.nodes.length).toEqual(1);
        expect(instance.edges.length).toEqual(1);

        instance.updateCanvasWithSingleNode(mockGraphNode);

        expect(instance.nodes.length).toEqual(1);
        expect(instance.edges.length).toEqual(0);
    });
});
