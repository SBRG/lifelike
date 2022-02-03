import { Component, Input } from '@angular/core';

import { isNil } from 'lodash-es';
import { Options } from 'vis-network';

import { GraphData } from 'app/interfaces/vis-js.interface';

export enum DisplayType {
  NETWORK = 'network',
  SANKEY = 'sankey'
}

@Component({
  selector: 'app-route-display',
  templateUrl: './route-display.component.html',
  styleUrls: ['./route-display.component.scss']
})
export class RouteDisplayComponent {
  @Input() set displayType(displayType: DisplayType) {
    this.currentDisplay = DisplayType[displayType];
  }
  @Input() set graphData(graphData: GraphData) {
    // Update vis js data
    this.networkData = graphData;

    // Update sankey data
    this.generateSankeyData(graphData.nodes, graphData.edges);

    // Update legend
    this.setupLegend(graphData.nodes);
  }

  currentDisplay: string;

  networkConfig: Options;
  networkData: GraphData;

  sankeyConfig: any;
  sankeyData: any;

  legend: Map<string, string[]>;

  constructor() {
    this.initVisJsSettings();
    this.initPlotlySankeySettings();
    this.legend = new Map<string, string[]>();
  }

  initVisJsSettings() {
    // Init vis js network settings
    this.networkConfig = {
      interaction: {
        hover: true,
        multiselect: true,
        selectConnectedEdges: false,
      },
      physics: {
        enabled: true,
        solver: 'barnesHut',
      },
      edges: {
        font: {
          size: 12,
        },
        length: 250,
        widthConstraint: {
          maximum: 90,
        },
      },
      nodes: {
        scaling: {
          min: 25,
          max: 50,
          label: {
            enabled: true,
            min: 12,
            max: 72,
            maxVisible: 72,
            drawThreshold: 5,
          },
        },
        shape: 'box',
        widthConstraint: {
          maximum: 180,
        },
      },
    };

    this.networkData = {
      nodes: [],
      edges: [],
    };
  }

  generateSankeyData(nodes: any[], edges: any[]) {
    const source = [];
    const target = [];
    const value = [];
    const label = [];
    const color = [];

    const nodeIdentityMap = new Map<number, number>();
    nodes.forEach((node, i) => {
      nodeIdentityMap.set(node.id, i);
      label.push(node.label);
      color.push(node.color.border);
    });

    const seenEdges = new Map<string, number>();
    edges.forEach(edge => {
      const sankeyEdge = [nodeIdentityMap.get(edge.from), nodeIdentityMap.get(edge.to)];
      if (seenEdges.has(sankeyEdge.toString())) {
        value[seenEdges.get(sankeyEdge.toString())] += 1;
      } else {
        source.push(sankeyEdge[0]);
        target.push(sankeyEdge[1]);
        value.push(1);
        seenEdges.set(sankeyEdge.toString(), value.length - 1);
      }
    });

    this.sankeyData = {
      type: 'sankey',
      orientation: 'h',
      node: {
        arrangement: 'snap',
        pad: 15,
        thickness: 20,
        line: {
          color: 'black',
          width: 0.5
        },
        label,
        color,
      },

      link: {
        source,
        target,
        value
      }
    };
  }

  initPlotlySankeySettings() {
    // Init plotly sankey settings
    this.sankeyData = {
      type: 'sankey',
      orientation: 'h',
      node: {
        arrangement: 'snap',
        pad: 15,
        thickness: 20,
        line: {
          color: 'black',
          width: 0.5
        },
        label: [],
        color: [],
      },

      link: {
        source: [],
        target: [],
        value: []
      }
    };

    this.sankeyConfig = {
      font: {
        size: 10
      }
    };
  }

  /**
   * Given a list of input nodes, generates a Map object representing a node legend. Keys are the label of the nodes, and values are a list
   * of colors representing the border and background of the node.
   * @param nodes list of node objects
   */
  setupLegend(nodes: any) {
    nodes.forEach((node) => {
      if (!isNil(node.databaseLabel)) {
        if (!this.legend.has(node.databaseLabel)) {
          this.legend.set(node.databaseLabel, [node.color.border, node.color.background]);
        }
      }
    });
  }

}
