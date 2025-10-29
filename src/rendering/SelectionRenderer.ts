import { SelectionManager } from '../input/SelectionManager';

export class SelectionRenderer {
  private container: HTMLElement;
  private overlayDiv: HTMLDivElement;
  private lineHeight: number;
  private charWidth: number;

  constructor(container: HTMLElement, lineHeight: number, charWidth: number) {
    this.container = container;
    this.lineHeight = lineHeight;
    this.charWidth = charWidth;

    // Create overlay div for rendering selections
    this.overlayDiv = document.createElement('div');
    this.overlayDiv.style.position = 'absolute';
    this.overlayDiv.style.top = '0';
    this.overlayDiv.style.left = '0';
    this.overlayDiv.style.width = '100%';
    this.overlayDiv.style.height = '100%';
    this.overlayDiv.style.overflow = 'hidden';
    this.overlayDiv.style.pointerEvents = 'none';
    this.overlayDiv.style.zIndex = '1';
    this.container.appendChild(this.overlayDiv);
  }

  updateDimensions(lineHeight: number, charWidth: number): void {
    this.lineHeight = lineHeight;
    this.charWidth = charWidth;
  }

  render(selectionManager: SelectionManager, scrollTop: number, lineContent: string[]): void {
    // Clear previous selections
    this.overlayDiv.innerHTML = '';

    const selection = selectionManager.getSelection();
    if (!selection) {
      return;
    }

    const { start, end } = selection;

    // Render selection rectangles for each line
    for (let line = start.line; line <= end.line; line++) {
      const lineText = lineContent[line] || '';

      let startCol = 0;
      let endCol = lineText.length;

      // First line: start from selection start column
      if (line === start.line) {
        startCol = start.column;
      }

      // Last line: end at selection end column
      if (line === end.line) {
        endCol = end.column;
      }

      // Don't render empty selections
      if (startCol >= endCol) {
        continue;
      }

      // Create selection rectangle
      const selectionRect = document.createElement('div');
      selectionRect.style.position = 'absolute';
      selectionRect.style.left = `${startCol * this.charWidth}px`;
      selectionRect.style.top = `${line * this.lineHeight - scrollTop}px`;
      selectionRect.style.width = `${(endCol - startCol) * this.charWidth}px`;
      selectionRect.style.height = `${this.lineHeight}px`;
      selectionRect.style.backgroundColor = 'rgba(100, 149, 237, 0.3)'; // Cornflower blue
      selectionRect.style.pointerEvents = 'none';

      this.overlayDiv.appendChild(selectionRect);
    }
  }

  clear(): void {
    this.overlayDiv.innerHTML = '';
  }
}
