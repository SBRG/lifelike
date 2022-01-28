import { MatSnackBar } from '@angular/material/snack-bar';

import { MapImageProviderService } from 'app/drawing-tool/services/map-image-provider.service';
import { NodeCreation } from 'app/graph-viewer/actions/nodes';
import { makeid, uuidv4 } from 'app/shared/utils/identifiers';
import { SizeUnits } from 'app/shared/constants';

import { AbstractCanvasBehavior, BehaviorEvent, BehaviorResult } from '../../behaviors';
import { CanvasGraphView } from '../canvas-graph-view';

export class ImageUploadBehavior extends AbstractCanvasBehavior {

  protected readonly mimeTypePattern = /^image\/(jpeg|png|gif|bmp)$/i;
  protected readonly maxFileSize = 20;
  protected readonly pasteSize = 300;

  constructor(protected readonly graphView: CanvasGraphView,
              protected readonly mapImageProvider: MapImageProviderService,
              protected readonly snackBar: MatSnackBar) {
    super();
  }

  private containsFiles(dataTransfer: DataTransfer) {
    if (dataTransfer.types) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < dataTransfer.types.length; i++) {
        if (dataTransfer.types[i] === 'Files') {
          return true;
        }
      }
    }

    return false;
  }

  private getFiles(dataTransfer: DataTransfer): File[] {
    const result: File[] = [];
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < dataTransfer.files.length; i++) {
      const file = dataTransfer.files[i];
      if (this.isSupportedFile(file)) {
        result.push(file);
      }
    }
    return result;
  }

  private isSupportedFile(file: File) {
    if (file.type.match(this.mimeTypePattern)) {
      if (file.size <= this.maxFileSize * SizeUnits.MiB) {
        return true;
      }
      this.snackBar.open(`Image size too big (>${this.maxFileSize} MiB)`, null, {
          duration: 4000,
      });
    }
    return false;
  }

  dragOver(event: BehaviorEvent<DragEvent>): BehaviorResult {
    const dragEvent = event.event;
    if (dragEvent?.dataTransfer && this.containsFiles(dragEvent.dataTransfer)) {
      dragEvent.preventDefault();
    }
    return BehaviorResult.Continue;
  }

  // TODO: This should be able to handle image file drop. Inspect why it is not
  drop(event: BehaviorEvent<DragEvent>): BehaviorResult {
    const dragEvent = event.event;
    const files = this.getFiles(dragEvent.dataTransfer);
    if (files.length) {
      dragEvent.stopPropagation();
      dragEvent.preventDefault();
      this.createImageNodes(files);
      return BehaviorResult.Stop;
    } else {
      return BehaviorResult.Continue;
    }
  }

  paste(event: BehaviorEvent<ClipboardEvent>): BehaviorResult {
    const position = this.graphView.currentHoverPosition;
    if (position) {
      const clipboardEvent = event.event;
      const files = this.getFiles(clipboardEvent.clipboardData);
      if (files.length) {
        this.createImageNodes(files);
        clipboardEvent.preventDefault();
        return BehaviorResult.Stop;
      }
    }
    return BehaviorResult.Continue;
  }

  private createImageNodes(files: File[]) {
    let i = 0;
    for (const file of files) {
      this.createImageNode(file, 15 * i, 15 * i);
      i++;
    }
  }

  private createImageNode(file: File, xOffset = 0, yOffset = 0) {
    const position = this.graphView.currentHoverPosition;
    if (position) {
      const imageId = makeid();
      this.mapImageProvider.doInitialProcessing(imageId, file).subscribe(dimensions => {
        // Scale smaller side up to 300 px
        const ratio = this.pasteSize / Math.min(dimensions.width, dimensions.height);
        this.graphView.execute(new NodeCreation(
        `Insert image`, {
          hash: uuidv4(),
          image_id: imageId,
          display_name: '',
          label: 'image',
          sub_labels: [],
          data: {
            x: position.x + xOffset,
            y: position.y + yOffset,
            width: dimensions.width * ratio,
            height: dimensions.height * ratio,
          },
        }, true));
      });
      return BehaviorResult.Stop;
    }
  }

}
