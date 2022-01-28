
const filterObjects = arr =>
  arr.filter(n => typeof n !== 'object' && n != null);

const nodesIdToMatchTerms = (nodeIds, nodes) =>
  nodes.filter(gn => nodeIds.includes(gn.id)).map(nodeToMatchTerms);

const linkToMatchTerms = (link, graph) =>
  Object.entries(link).reduce((o, [k, n]) => {
    if (Array.isArray(n)) {
      if (k === 'nodes') {
        o = o.concat(nodesIdToMatchTerms(n, graph.nodes));
      } else {
        o = o.concat(filterObjects(n));
      }
    } else if (typeof n === 'object' && n !== null && (n as { nodes: Array<number> }).nodes !== undefined) {
      o = o.concat(nodesIdToMatchTerms((n as { nodes: Array<number> }).nodes, graph.nodes));
    } else if (typeof n !== 'object' && n !== null) {
      o.push(n);
    }
    return o;
  }, []) as Array<any>;

export function isLinkMatching(matcher, link, graph?) {
  const text = linkToMatchTerms(link, graph).join(' ').toLowerCase();
  return matcher(text);
}

const nodeToMatchTerms = node =>
  Object.values(node).reduce((o: Array<any>, n) => {
    if (Array.isArray(n)) {
      o = o.concat(filterObjects(n));
    } else if (typeof n !== 'object' && n !== null) {
      o.push(n);
    }
    return o;
  }, []) as Array<any>;

export function isNodeMatching(matcher, node, graph?) {
  const text = nodeToMatchTerms(node).join(' ').toLowerCase();
  return matcher(text);
}
