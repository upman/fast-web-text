export interface VisibleLineRange {
  startLine: number;
  endLine: number;
}

export class ViewportManager {
  private lineHeight: number = 18;
  private canvasHeight: number;

  constructor(canvasHeight: number) {
    this.canvasHeight = canvasHeight;
  }

  setCanvasHeight(height: number): void {
    this.canvasHeight = height;
  }

  setLineHeight(height: number): void {
    this.lineHeight = height;
  }

  getVisibleLineRange(scrollTop: number, totalLines: number): VisibleLineRange {
    const startLine = Math.floor(scrollTop / this.lineHeight);
    const visibleLineCount = Math.ceil(this.canvasHeight / this.lineHeight);
    const endLine = Math.min(startLine + visibleLineCount, totalLines - 1);

    return {
      startLine: Math.max(0, startLine),
      endLine: Math.max(0, endLine)
    };
  }

  getVisibleLinesWithBuffer(scrollTop: number, totalLines: number, buffer: number = 10): number[] {
    const visible = this.getVisibleLineRange(scrollTop, totalLines);

    const startLine = Math.max(0, visible.startLine - buffer);
    const endLine = Math.min(totalLines - 1, visible.endLine + buffer);

    const lines: number[] = [];
    for (let i = startLine; i <= endLine; i++) {
      lines.push(i);
    }

    return lines;
  }

  getTotalHeight(lineCount: number): number {
    return lineCount * this.lineHeight;
  }

  getLineHeight(): number {
    return this.lineHeight;
  }
}
