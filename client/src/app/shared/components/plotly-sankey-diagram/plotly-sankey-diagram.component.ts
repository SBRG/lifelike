import { AfterViewInit, Component, Input } from '@angular/core';

import * as d3 from 'd3';

import { uuidv4 } from 'app/shared/utils';

declare const Plotly: any;

@Component({
  selector: 'app-plotly-sankey-diagram',
  templateUrl: './plotly-sankey-diagram.component.html',
  styleUrls: ['./plotly-sankey-diagram.component.scss']
})
export class PlotlySankeyDiagramComponent implements AfterViewInit {
  @Input() config: any;
  @Input() data: any = {};
  @Input() legend: Map<string, string[]>;

  sankeyContainerId: string;

  stabilized: boolean;

  constructor() {
    this.stabilized = false;
    this.sankeyContainerId = uuidv4();
  }

  ngAfterViewInit() {
    const container = document.getElementById(this.sankeyContainerId);
    Plotly.newPlot(
      container,
      [this.data],
      this.config,
      { staticPlot: false }
    ).then(() => {
      this.stabilized = true;
      this.setupEvents();
    });
  }

  styleLinks(links, style: any) {
    Object.keys(style).forEach(property => links.style(property, style[property]));
  }

  styleLinksConnectedToNode(nodeId: number, style: any) {
    const links = d3
      .selectAll('path.sankey-link')
      .filter((d) => {
        // @ts-ignore
        return d.link.source.index === nodeId || d.link.target.index === nodeId;
      });

    Object.keys(style).forEach(property => links.style(property, style[property]));
  }

  setupEvents() {
    // Capture all "node" elements on the canvas and setup on-hover behavior
    const nodeBoxes = d3.selectAll('.node-capture');
    nodeBoxes.on('mouseover', (node) => {
      const incomingLinks = d3
        .selectAll('path.sankey-link')
        .filter((link) => {
          // @ts-ignore
          return link.link.target.index === node.index;
        });

      const outgoingLinks = d3
        .selectAll('path.sankey-link')
        .filter((link) => {
          // @ts-ignore
          return link.link.source.index === node.index;
        });

      this.styleLinks(incomingLinks, {fill: 'red'});
      this.styleLinks(outgoingLinks, {fill: '#0c8caa'});
    });
    nodeBoxes.on('mouseout', d => {
      // @ts-ignore
      this.styleLinksConnectedToNode(d.index, {fill: 'black'});
    });

    // Do the same for node labels (these also trigger on-hover behavior for links)
    const nodeLabels = d3.selectAll('.node-entered');
    nodeLabels.on('mouseover', (node) => {
      const incomingLinks = d3
        .selectAll('path.sankey-link')
        .filter(link => {
          // @ts-ignore
          return link.link.target.index === node.index;
        });

      const outgoingLinks = d3
        .selectAll('path.sankey-link')
        .filter(link => {
          // @ts-ignore
          return link.link.source.index === node.index;
        });

      this.styleLinks(incomingLinks, {fill: 'red'});
      this.styleLinks(outgoingLinks, {fill: '#0c8caa'});
    });
    nodeLabels.on('mouseout', d => {
      // @ts-ignore
      this.styleLinksConnectedToNode(d.index, {fill: 'black'});
    });

    // Capture all "link" elements on the canvas and setup on-hover behavior
    const links = d3.selectAll('path.sankey-link');
    links.on('mouseover', function() {
      d3.select(this).style('fill', '#0c8caa');
    });
    links.on('mouseout', function() {
      d3.select(this).style('fill', 'black');
    });
  }
}
