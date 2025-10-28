export class LineWidthCache {
  private cache: Map<number, number> = new Map();
  private maxWidth: number = 0;

  getLineWidth(lineNumber: number): number | undefined {
    return this.cache.get(lineNumber);
  }

  setLineWidth(lineNumber: number, width: number): void {
    this.cache.set(lineNumber, width);
    this.maxWidth = Math.max(this.maxWidth, width);
  }

  invalidateLine(lineNumber: number): void {
    this.cache.delete(lineNumber);
    if (this.cache.size > 0) {
      this.maxWidth = Math.max(...this.cache.values());
    } else {
      this.maxWidth = 0;
    }
  }

  getMaxWidth(): number {
    return this.maxWidth;
  }

  clear(): void {
    this.cache.clear();
    this.maxWidth = 0;
  }
}
