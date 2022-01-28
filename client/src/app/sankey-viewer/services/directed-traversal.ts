import { sum } from 'd3-array';

interface Direction {
  nextLinksAccessor: string;
  prevLinksAccessor: string;
  nodeAccessor: string;
}

export const ltr = {
  nextLinksAccessor: '_sourceLinks',
  prevLinksAccessor: '_targetLinks',
  nodeAccessor: '_target'
} as Direction;

export const rtl = {
  nextLinksAccessor: '_targetLinks',
  prevLinksAccessor: '_sourceLinks',
  nodeAccessor: '_source'
} as Direction;

export class DirectedTraversal {
  direction: Direction;
  startNodes: Array<any>;
  private endNodes: Array<any>;

  constructor([inNodes, outNodes]) {
    // figure out if we traverse ltr or rtl based on the number of nodes on each side (and their links)
    // side with smaller number of nodes; less links is the one we start with
    if (((
      inNodes.length
      - outNodes.length
    ) || (
      sum(outNodes, ({_targetLinks = []}) => _targetLinks.length)
      - sum(inNodes, ({_sourceLinks = []}) => _sourceLinks.length)
    )) < 0) {
      this.direction = ltr;
      this.startNodes = inNodes;
      this.endNodes = outNodes;
    } else {
      this.direction = rtl;
      this.startNodes = outNodes;
      this.endNodes = inNodes;
    }
  }

  reverse() {
    const { direction, startNodes, endNodes } = this;
    this.direction = direction === rtl ? ltr : rtl;
    this.startNodes = endNodes;
    this.endNodes = startNodes;
  }

  depthSorter(asc = true) {
    const { direction } = this;
    const sortDirection = Math.pow(-1, Number(asc !== (direction === ltr)));
    return (a, b) => sortDirection * (a._depth - b._depth);
  }

  nextLinks(node) {
    return node[this.direction.nextLinksAccessor];
  }

  prevLinks(node) {
    return node[this.direction.prevLinksAccessor];
  }

  nextNode(link) {
    return link[this.direction.nodeAccessor];
  }
}
