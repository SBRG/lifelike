import * as d3Sankey from 'd3-sankey';
import { ValueFn } from 'd3-selection';
import {color} from 'd3-color';

import { TruncatePipe } from 'app/shared/pipes';
import { SankeyNode, SankeyLink } from 'app/shared-sankey/interfaces';


export class AttributeAccessors {
  constructor(readonly truncatePipe: TruncatePipe) {
  }

  get id(): ValueFn<any, SankeyNode | SankeyLink, number | string> {
    return ({_id}) => _id;
  }

  get nodeLabel(): ValueFn<any, SankeyNode, string> {
    return ({label = ''}) => label;
  }

  get nodeLabelShort(): ValueFn<any, SankeyNode, string> {
    const {nodeLabel, truncatePipe: {transform}} = this;
    return (d, i?, n?) => transform(nodeLabel(d, i, n), AttributeAccessors.labelEllipsis);
  }

  get nodeLabelShouldBeShorted(): ValueFn<any, SankeyNode, boolean> {
    const {nodeLabel} = this;
    return (d, i, n) => nodeLabel(d, i, n).length > AttributeAccessors.labelEllipsis;
  }

  // color can be object with toString method
  get nodeColor(): ValueFn<any, SankeyNode, string | object> {
    return ({_color}) => _color;
  }

  // color can be object with toString method
  get linkColor(): ValueFn<any, SankeyLink, string | object> {
    return ({_color}) => _color;
  }

  get linkBorder() {
    return undefined;
  }

  get nodeTitle(): ValueFn<any, SankeyNode, string> {    return ({description}) => description;
  }

  get linkTitle(): ValueFn<any, SankeyLink, string> {
    return ({description}) => description;
  }

  get value(): (node: SankeyNode) => number {
    return ({_value = 0}) => _value;
  }

  get linkPath(): ValueFn<any, SankeyLink, string> {
    return d3Sankey.sankeyLinkHorizontal;
  }

  get circular(): ValueFn<any, SankeyLink, boolean> {
    return ({_circular}) => _circular;
  }

  get fontSize(): ValueFn<any, SankeyNode, number | string> {
    return () => 12;
  }

  static labelEllipsis = 10;
}
