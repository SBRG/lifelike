export function isClipboardEventNativelyHandled(event: ClipboardEvent) {
  // So the problem is that we want to capture all copy/paste except the ones that are supposed
  // to go into an element that takes the copy/paste, but there isn't a way to detect if a
  // a native element has accepted the copy/paste (maybe I'm wrong), so this makes this task
  // a little difficult. For now, we're going to just ignore copies from/pastes into
  // basic form fields, but this doesn't cover all cases (like contenteditable)
  return event.target instanceof Element &&
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.nodeName);
}
