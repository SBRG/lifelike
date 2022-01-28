export class DragImage {
  constructor(readonly image: HTMLElement,
              readonly x: number,
              readonly y: number) {
  }

  addDataTransferData(dataTransfer: DataTransfer) {
    document.body.appendChild(this.image);
    dataTransfer.setDragImage(this.image, this.x, this.y);
    setTimeout(() => this.image.remove(), 500);
  }
}
