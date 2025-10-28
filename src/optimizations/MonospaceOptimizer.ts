export class MonospaceOptimizer {
  private isMonospace: boolean = false;
  private charWidth: number = 0;
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;

  constructor() {
    this.canvas = new OffscreenCanvas(100, 100);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
  }

  detectMonospace(fontFamily: string, fontSize: number): boolean {
    this.ctx.font = `${fontSize}px ${fontFamily}`;

    const testChars = 'iMW0123';
    const widths = testChars.split('').map(c => this.measureChar(c));

    const allEqual = widths.every(w => Math.abs(w - widths[0]) < 0.1);

    if (allEqual) {
      this.isMonospace = true;
      this.charWidth = widths[0];
    }

    return this.isMonospace;
  }

  private measureChar(char: string): number {
    const metrics = this.ctx.measureText(char);
    return metrics.width;
  }

  getCharPosition(column: number, text?: string): number {
    if (this.isMonospace) {
      return column * this.charWidth;
    } else {
      if (!text) return 0;
      return this.measureWidth(text.substring(0, column));
    }
  }

  private measureWidth(text: string): number {
    const metrics = this.ctx.measureText(text);
    return metrics.width;
  }

  getIsMonospace(): boolean {
    return this.isMonospace;
  }

  getCharWidth(): number {
    return this.charWidth;
  }
}
