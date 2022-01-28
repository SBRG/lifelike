# Graph Viewer and Editor

This collection of files implements a framework for a graph editor and viewer.

```typescript
const style = new KnowledgeMapStyle();
const graphCanvas = new CanvasGraphView(canvasTag, {
  nodeRenderStyle: style,
  edgeRenderStyle: style,
});
graphCanvas.behaviors.add('delete-keyboard-shortcut', new DeleteKeyboardShortcut(graphCanvas), -100);
// ... more behaviors...
graphCanvas.backgroundFill = '#f2f2f2';
graphCanvas.startParentFillResizeListener();
graphCanvas.startAnimationLoop(); // Note: If calling from Angular, call outside Angular with ngZone

// When done:
graphCanvas.destroy();
```

## Organization

* [renderers/](renderers/) - The renderers themselves and the starting point of all this code
* [styles/](styles/) - Renderers use style objects to convert graph data into drawing primitives that
    have metrics (width, height, bbox) and draw() methods
* [actions/](actions/) - `Actions` abstract user-initiated *actions* so they can be rolled back or redone --
    when you need to record something the user did, create an action and call `renderer.execute(action)`
* [utils/](utils/) - Utility methods used by the graph viewer
    * [canvas/](utils/canvas/) - Where most of the HTML5 canvas drawing routines are actually stored

## Todo

* [ ] Improve performance to the point that we can render 1,000,000 nodes (or at least a LOT)
    * [ ] Automatically decide when to not draw text (text rendering is extremely expensive)
    * [ ] Automatically decide when to not draw round node corners (`arc()` is a little expensive)
    * [ ] Cache word wrapping results as much as possible in `TextElement` (text metrics are expensive)
    * [ ] Consider drawing nodes onto off-screen canvases in `PlacedNode` and `PlacedEdge` and then
        copying those canvases onto the main canvas when draw() is called for maximum performance
    * [ ] Minimize PlaceNode/PlacedEdge cache invalidation caused by some operations
    * [ ] When zooming or panning, take a screenshot of the canvas and manipulate that, waiting to
        re-draw the whole canvas when zooming has completed
    * [ ] Only re-draw changed portions of the canvas when changing graph data (currently possible!
        we have bboxes)
    * [ ] Only re-draw new portions of the canvas when panning
    * [ ] Use a spatial index or culling to make `getEntityAtMouse()` fast as possible
