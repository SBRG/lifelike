import { MatSnackBar } from '@angular/material/snack-bar';

import { isCtrlOrMetaPressed } from 'app/shared/utils';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';

/**
 * Implements CTRL/CMD-Z and CTRL/CMD-Y.
 */
export class HistoryKeyboardShortcutsBehavior extends AbstractCanvasBehavior {
  constructor(private readonly graphView: CanvasGraphView,
              private readonly snackBar: MatSnackBar) {
    super();
  }

  keyDown(event: BehaviorEvent<KeyboardEvent>): BehaviorResult {
    if (isCtrlOrMetaPressed(event.event) && event.event.code === 'KeyZ') {
      const action = this.graphView.undo();
      if (!action) {
        this.snackBar.open('Nothing left to undo.', null, {
          duration: 2000,
        });
      }
      return BehaviorResult.Stop;
    } else if (isCtrlOrMetaPressed(event.event) && event.event.code === 'KeyY') {
      const action = this.graphView.redo();
      if (!action) {
        this.snackBar.open('Nothing left to redo.', null, {
          duration: 2000,
        });
      }
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }

}
