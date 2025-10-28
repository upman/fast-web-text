export interface Position {
  line: number;
  column: number;
}

export interface Selection {
  start: Position;
  end: Position;
}

export class SelectionManager {
  private anchor: Position | null = null;
  private head: Position | null = null;

  startSelection(position: Position): void {
    this.anchor = { ...position };
    this.head = { ...position };
  }

  updateSelection(position: Position): void {
    if (this.anchor) {
      this.head = { ...position };
    }
  }

  clearSelection(): void {
    this.anchor = null;
    this.head = null;
  }

  hasSelection(): boolean {
    if (!this.anchor || !this.head) return false;
    return this.anchor.line !== this.head.line || this.anchor.column !== this.head.column;
  }

  getSelection(): Selection | null {
    if (!this.anchor || !this.head) return null;

    const start = this.comparePositions(this.anchor, this.head) <= 0 ? this.anchor : this.head;
    const end = this.comparePositions(this.anchor, this.head) <= 0 ? this.head : this.anchor;

    return { start, end };
  }

  private comparePositions(a: Position, b: Position): number {
    if (a.line !== b.line) {
      return a.line - b.line;
    }
    return a.column - b.column;
  }

  isPositionInSelection(position: Position): boolean {
    const selection = this.getSelection();
    if (!selection) return false;

    const cmpStart = this.comparePositions(position, selection.start);
    const cmpEnd = this.comparePositions(position, selection.end);

    return cmpStart >= 0 && cmpEnd <= 0;
  }

  getSelectionRange(): { startLine: number; endLine: number } | null {
    const selection = this.getSelection();
    if (!selection) return null;

    return {
      startLine: selection.start.line,
      endLine: selection.end.line,
    };
  }
}
