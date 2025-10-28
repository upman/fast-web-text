export interface Range {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface Token {
  type: string;
  content: string;
  startColumn: number;
  endColumn: number;
}

export interface LineData {
  content: string;
  tokens: Token[];
  width?: number;
}

export class Document {
  private lines: string[];
  private lineCache: Map<number, LineData>;

  constructor(content: string) {
    this.lines = content.split('\n');
    this.lineCache = new Map();
  }

  getLine(lineNumber: number): string {
    if (lineNumber < 0 || lineNumber >= this.lines.length) {
      return '';
    }
    return this.lines[lineNumber];
  }

  getLineCount(): number {
    return this.lines.length;
  }

  insertText(line: number, col: number, text: string): void {
    if (line < 0 || line >= this.lines.length) {
      return;
    }

    const currentLine = this.lines[line];
    const before = currentLine.substring(0, col);
    const after = currentLine.substring(col);

    const textLines = text.split('\n');

    if (textLines.length === 1) {
      this.lines[line] = before + text + after;
    } else {
      this.lines[line] = before + textLines[0];
      for (let i = 1; i < textLines.length - 1; i++) {
        this.lines.splice(line + i, 0, textLines[i]);
      }
      this.lines.splice(line + textLines.length - 1, 0, textLines[textLines.length - 1] + after);
    }

    this.lineCache.delete(line);
  }

  deleteText(range: Range): void {
    if (range.startLine === range.endLine) {
      const line = this.lines[range.startLine];
      const before = line.substring(0, range.startColumn);
      const after = line.substring(range.endColumn);
      this.lines[range.startLine] = before + after;
      this.lineCache.delete(range.startLine);
    } else {
      const firstLine = this.lines[range.startLine].substring(0, range.startColumn);
      const lastLine = this.lines[range.endLine].substring(range.endColumn);
      this.lines[range.startLine] = firstLine + lastLine;
      this.lines.splice(range.startLine + 1, range.endLine - range.startLine);

      for (let i = range.startLine; i <= range.endLine; i++) {
        this.lineCache.delete(i);
      }
    }
  }

  getLineData(lineNumber: number): LineData | undefined {
    return this.lineCache.get(lineNumber);
  }

  setLineData(lineNumber: number, data: LineData): void {
    this.lineCache.set(lineNumber, data);
  }

  invalidateLineCache(lineNumber: number): void {
    this.lineCache.delete(lineNumber);
  }
}
