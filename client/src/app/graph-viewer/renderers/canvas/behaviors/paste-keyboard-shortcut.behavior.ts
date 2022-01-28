import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import {
  GraphEntity,
  GraphEntityType,
  UniversalGraphNode,
} from 'app/drawing-tool/services/interfaces';
import { CompoundAction, GraphAction } from 'app/graph-viewer/actions/actions';
import { uuidv4 } from 'app/shared/utils/identifiers';
import { DataTransferDataService } from 'app/shared/services/data-transfer-data.service';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';

/**
 * We use this string to know that it's our own JSON.
 */
export const TYPE_STRING = 'LifelikeKnowledgeMap/1';

export interface GraphClipboardData {
  type: 'LifelikeKnowledgeMap/1';
  selection: GraphEntity[];
}

/**
 * Implements the paste key.
 */
export class PasteKeyboardShortcutBehavior extends AbstractCanvasBehavior {
  // TODO: fix boundPaste if not coming in next patch
  constructor(private readonly graphView: CanvasGraphView,
              protected readonly dataTransferDataService: DataTransferDataService) {
    super();
  }

  paste(event: BehaviorEvent<ClipboardEvent>): BehaviorResult {
    const position = this.graphView.currentHoverPosition;
    if (position) {
      const content = event.event.clipboardData.getData('text/plain');
      if (content) {
        this.graphView.execute(this.createActionFromPasteContent(content, position));
        event.event.preventDefault();
        return BehaviorResult.Stop;
      }
    }
    return BehaviorResult.Continue;
  }
  /**
   * Returns a node creation action based on the content provided.
   * @param content the content (like from the clipboard)
   * @param position the position of the node
   */
  private createActionFromPasteContent(content: string, position: { x: number, y: number }): GraphAction {
    try {
      const actions = [];
      const data: GraphClipboardData = JSON.parse(content);

      // First try to read the data as JSON
      if (data.type === TYPE_STRING) {
        for (const entry of data.selection) {
          if (entry.type === GraphEntityType.Node) {
            const node = entry.entity as UniversalGraphNode;
            actions.push(new NodeCreation(
              `Paste content from clipboard`, {
                ...node,
                hash: uuidv4(),
                data: {
                  ...node.data,
                  x: position.x,
                  y: position.y,
                },
              }, true,
            ));
          }
        }
        if (actions.length) {
          return new CompoundAction('Paste content', actions);
        }
      }
    } catch (e) {
      // TODO: throw error?
    }

    return new NodeCreation(
      `Paste content from clipboard`, {
        display_name: 'Note',
        hash: uuidv4(),
        label: 'note',
        sub_labels: [],
        data: {
          x: position.x,
          y: position.y,
          detail: content,
        },
        style: {
          showDetail: true
        }
      }, true,
    );
  }
}
