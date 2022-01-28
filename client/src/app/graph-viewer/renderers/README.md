# Graph Renderers

Different graph renderers are stored inside here, although as of writing, there is
only one renderer (a HTML5 canvas-based one).

* [Canvas renderer](canvas/)

## Behaviors

`behaviors.ts` provides a generic framework of modules that add UI functionality to
a renderer. Basically, you start off with a basic graph renderer and then add 
behaviors like 'delete key deletes selected entities' to a graph based on your
needs.

Behaviors are currently not very applicable between different renderers, so 
current behavior implementations are in their respective renderer folder
(i.e. `canvas/behaviors`).
