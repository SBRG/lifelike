# Graph Styles

This directory holds *graph styles* which generate the JS objects needed to actually
render a graph based on the properties of nodes and edges. Styles are very
much bound to their renderer (i.e. canvas vs SVG), however, the directory is here
because styles share basic mechanics (`PlacedNode`, `PlacedEdge`).
