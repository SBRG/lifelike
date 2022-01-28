# Canvas Renderer

Renders using a HTML5 `<canvas>` tag.

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
