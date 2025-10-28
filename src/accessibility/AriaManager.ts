export interface EditorState {
  cursorLine: number;
  cursorColumn: number;
  lineCount: number;
  hasSelection: boolean;
}

export class AriaManager {
  private liveRegion: HTMLDivElement | null = null;

  constructor() {
    this.createLiveRegion();
  }

  private createLiveRegion(): void {
    this.liveRegion = document.createElement('div');
    this.liveRegion.id = 'editor-live-region';
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.style.position = 'absolute';
    this.liveRegion.style.left = '-9999px';
    this.liveRegion.style.width = '1px';
    this.liveRegion.style.height = '1px';
    this.liveRegion.style.overflow = 'hidden';
    document.body.appendChild(this.liveRegion);
  }

  updateAttributes(canvas: HTMLCanvasElement, state: EditorState): void {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label',
      `Code editor, line ${state.cursorLine + 1} of ${state.lineCount}, column ${state.cursorColumn + 1}`
    );

    if (state.hasSelection) {
      canvas.setAttribute('aria-description', 'Text selected');
    } else {
      canvas.removeAttribute('aria-description');
    }
  }

  announceChange(message: string): void {
    if (this.liveRegion) {
      this.liveRegion.textContent = '';
      setTimeout(() => {
        if (this.liveRegion) {
          this.liveRegion.textContent = message;
        }
      }, 100);
    }
  }

  announceLineChange(lineNumber: number, totalLines: number): void {
    this.announceChange(`Line ${lineNumber + 1} of ${totalLines}`);
  }

  announceTextInserted(text: string): void {
    this.announceChange(`Inserted: ${text}`);
  }

  announceTextDeleted(text: string): void {
    this.announceChange(`Deleted: ${text}`);
  }
}
