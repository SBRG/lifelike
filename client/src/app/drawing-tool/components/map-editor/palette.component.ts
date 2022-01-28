import { Component } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

import { AnnotationStyle, annotationTypes } from 'app/shared/annotation-styles';

import { UniversalGraphNode, UniversalGraphNodeTemplate } from '../../services/interfaces';
import { createNodeDragImage } from '../../utils/drag';

@Component({
  selector: 'app-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./palette.component.scss'],
})
export class PaletteComponent {
  nodeTemplates = annotationTypes;
  expanded = false;

  constructor(
    private readonly snackBar: MatSnackBar,
  ) {
  }

  /**
   * Get the node templates that we plan to show, based on whether
   * we have this baby expanded.
   */
  get nodeTemplatesShown() {
    if (this.expanded) {
      return this.nodeTemplates;
    } else {
      return this.nodeTemplates.slice(0, 8);
    }
  }

  toggleExpansion() {
    this.expanded = !this.expanded;
  }

  dragStart(event: DragEvent, annotationStyle: AnnotationStyle) {
    const copiedNode: UniversalGraphNodeTemplate = {
      display_name: annotationStyle.label,
      label: annotationStyle.label,
      sub_labels: [],
    };

    const dragImageNode: UniversalGraphNode = {
      ...copiedNode,
      hash: '',
      data: {
        x: 0,
        y: 0,
      },
    };

    const dataTransfer: DataTransfer = event.dataTransfer;
    createNodeDragImage(dragImageNode).addDataTransferData(dataTransfer);
    dataTransfer.setData('text/plain', annotationStyle.label);
    dataTransfer.setData('application/lifelike-node', JSON.stringify(copiedNode));
  }

  click() {
    this.snackBar.open('Drag from the palette to the graph to create new nodes.', null, {
      duration: 3000,
    });
  }
}
