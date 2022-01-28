export enum networkEdgeSmoothers {
  DYNAMIC = 'dynamic',
  CONTINUOUS = 'continuous',
  DISCRETE = 'discrete',
  DIAGONAL_CROSS = 'diagonalCross',
  STRAIGHT_CROSS = 'straightCross',
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
  CUBIC_BEZIER = 'cubicBezier',
}

export enum networkSolvers {
  BARNES_HUT = 'barnesHut',
  FORCE_ATLAS_2_BASED = 'forceAtlas2Based',
  // Disabling this for now, as it seems to require additional configuration that we cannot assume will be present.
  // HIERARCHICHAL_REPULSION = 'hierarchicalRepulsion',
  REPULSION = 'repulsion'
}
