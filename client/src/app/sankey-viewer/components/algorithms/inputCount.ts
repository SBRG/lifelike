import { partition, sumBy, mean } from 'lodash-es';

import { ExtendedMap, ExtendedWeakMap } from 'app/shared/utils/types';
import { SankeyLink, SankeyNode, SankeyData, SankeyTrace } from 'app/shared-sankey/interfaces';

import { DirectedTraversal } from '../../services/directed-traversal';
import { CustomisedSankeyLayoutService } from '../../services/customised-sankey-layout.service';
import { SankeyControllerService } from '../../services/sankey-controller.service';

export function calculateInputCountSkippingCircularLinks(
  this: SankeyControllerService,
  sortedNodes,
  dt: DirectedTraversal,
  maxExpectedValue: number,
  nextLinkValue: (nodeValue: number, nextLinks) => number
) {
  sortedNodes.forEach(n => {
    if (dt.startNodes.includes(n.id)) {
      n._fixedValue = 1;
    } else {
      n._fixedValue = 0;
    }
    const prevLinks = dt.prevLinks(n);
    const nextLinks = dt.nextLinks(n);
    n._fixedValue = prevLinks.reduce((a, l) => a + l._value, n._fixedValue || 0);
    this.warningController.assert(n._fixedValue <= maxExpectedValue, 'Input count algorithm fail - node value exceeds input node count');
    const outFrac = nextLinkValue(n._fixedValue, nextLinks);
    nextLinks.forEach(l => {
      // skip setting circular values
      if (!l._circular) {
        l._value = outFrac;
      }
    });
  });
}

export function initInputCountCalculation(
  this: SankeyControllerService,
  layout, data: SankeyData
) {
  // initially links does not carry values but we need to init it
  data.links.forEach(l => {
    l._value = 0;
  });
  // don't calculate whole layout, only things needed to get nodes depths
  layout.computeNodeLinks(data);
  layout.identifyCircles(data);
  layout.computeNodeValues(data);
  layout.computeNodeDepths(data);
  layout.computeNodeReversedDepths(data);
  layout.computeNodeLayers(data);
  // traverse from side with less nodes
  const dt = new DirectedTraversal([data._inNodes, data._outNodes]);
  // traverse starting from leaves nodes
  dt.reverse();
  return {
    dt,
    // for checks
    maxExpectedValue: dt.startNodes.length,
    // iterate nodes leaves first
    sortedNodes: [...data.nodes].sort(dt.depthSorter())
  };
}

/**
 * make lists of links passing each immediate space between node layers
 */
export function getLinkLayers<Link extends SankeyLink>(
  this: SankeyControllerService,
  links: Link[]
): Map<number, Link[]> {
  const linkLayers = new ExtendedMap<number, Link[]>();
  links.forEach(link => {
    const sourceLayer = (link._source as SankeyNode)._layer;
    const targetLayer = (link._target as SankeyNode)._layer;
    const minLayer = Math.min(sourceLayer, targetLayer);
    const maxLayer = Math.max(sourceLayer, targetLayer);
    for (let layer = minLayer; layer < maxLayer; layer++) {
      const layerLinks = linkLayers.getSet(layer, []);
      layerLinks.push(link as Link);
    }
  });
  return linkLayers;
}

export function calculateInputCountSkippingCircularLinksA(
  this: SankeyControllerService,
  sortedNodes,
  dt: DirectedTraversal,
  maxExpectedValue: number
) {
  calculateInputCountSkippingCircularLinks.call(
    this,
    sortedNodes,
    dt,
    maxExpectedValue,
    (nodeValue, nextLinks) =>
      nodeValue / nextLinks.length
  );
}

export function calculateInputCountSkippingCircularLinksB(
  this: SankeyControllerService,
  sortedNodes,
  dt: DirectedTraversal,
  maxExpectedValue: number
) {
  calculateInputCountSkippingCircularLinks.call(
    this,
    sortedNodes,
    dt,
    maxExpectedValue,
    (nodeValue, nextLinks) => {
      const nextNonCircularLinks = nextLinks.filter(({_circular}) => !_circular);
      const nextCircularLinksSum = nextLinks.filter(({_circular}) => _circular).reduce((acc, l) => acc + l._value, 0);
      return (nodeValue - nextCircularLinksSum) / nextNonCircularLinks.length;
    }
  );
}

export function inputCount(
  this: SankeyControllerService,
  data: SankeyData
) {
  // @ts-ignore
  const layout = new CustomisedSankeyLayoutService();
  const {
    sortedNodes,
    dt,
    maxExpectedValue
  } = initInputCountCalculation.call(this, layout, data);
  calculateInputCountSkippingCircularLinksA.call(this, sortedNodes, dt, maxExpectedValue);
  // estimate circular link values based on trace information (LL-3704)
  const linkLayers = getLinkLayers.call(this, data.links);
  const perLayerLinkEstimation = new ExtendedWeakMap<SankeyLink, number[]>();
  linkLayers.forEach(layer => {
    const [circularLinks, normalLinks] = partition(layer, ({_circular}) => _circular);
    const circularTraces = new Set(circularLinks.map(({_trace}) => _trace));
    const traceCircularEstimation = new WeakMap<SankeyTrace, number>();
    for (const circularTrace of circularTraces) {
      const traceNormalLinks = normalLinks.filter(({_trace}) => _trace === circularTrace);
      const traceCircularLinks = circularLinks.filter(({_trace}) => _trace === circularTrace);
      const traceNormalLinksValue = sumBy(traceNormalLinks, ({_value}) => _value);
      // each trace should flow only value of one so abs(sum(link values) - sum(circular values)) = 1
      // yet it remains an estimate cause we do not know which circular link contribution to sum
      // ass a good estimate assuming that each circular link contributes equal factor of sum
      // might want to revisit it later
      const traceCircularLinkEstimation = Math.abs(traceNormalLinksValue - 1) / traceCircularLinks.length;
      traceCircularEstimation.set(circularTrace, traceCircularLinkEstimation);
    }
    circularLinks.forEach(circularLink => {
      const circularLinkEstimation = traceCircularEstimation.get(circularLink._trace);
      const estimations = perLayerLinkEstimation.getSet(circularLink, []);
      estimations.push(circularLinkEstimation);
    });
    circularLinks.forEach(circularLink => {
      circularLink._value = mean(perLayerLinkEstimation.get(circularLink));
      this.warningController.assert(circularLink._value <= maxExpectedValue,
        'Input count algorithm fail - node value exceeds input node count');
    });
  });
  // propagate changes
  calculateInputCountSkippingCircularLinksB.call(this, sortedNodes, dt, maxExpectedValue);

  return {
    nodes: data.nodes
      .filter(n => n._sourceLinks.length + n._targetLinks.length > 0),
    links: data.links,
    _sets: {
      link: {
        _value: true
      }
    }
  };
}
