import { Document } from './Document';
import { ViewportManager } from './ViewportManager';
import { WebGPURenderer } from '../rendering/WebGPURenderer';
import { CursorRenderer } from '../rendering/CursorRenderer';
import { SelectionRenderer } from '../rendering/SelectionRenderer';
import { SyntaxHighlighter } from '../syntax/SyntaxHighlighter';
import { ScreenReaderSupport } from '../accessibility/ScreenReaderSupport';
import { AriaManager } from '../accessibility/AriaManager';
import { InputHandler } from '../input/InputHandler';
import { SelectionManager } from '../input/SelectionManager';
import { MonospaceOptimizer } from '../optimizations/MonospaceOptimizer';
import { LineWidthCache } from '../optimizations/LineWidthCache';
import { LayerHinting } from '../optimizations/LayerHinting';

export class Editor {
  private document: Document;
  private renderer: WebGPURenderer;
  private cursorRenderer: CursorRenderer;
  private selectionRenderer: SelectionRenderer;
  private viewport: ViewportManager;
  private highlighter: SyntaxHighlighter;
  private screenReader: ScreenReaderSupport;
  private ariaManager: AriaManager;
  private inputHandler: InputHandler;
  private selectionManager: SelectionManager;
  private monospaceOpt: MonospaceOptimizer;
  private widthCache: LineWidthCache;
  private layerHinting: LayerHinting;

  private scrollTop: number = 0;
  private cursorLine: number = 0;
  private cursorColumn: number = 0;
  private canvas: HTMLCanvasElement;
  private container: HTMLElement;
  private needsRender: boolean = false;

  constructor(container: HTMLElement, canvas: HTMLCanvasElement) {
    this.container = container;
    this.canvas = canvas;
    this.document = new Document('');
    this.renderer = new WebGPURenderer(canvas);
    this.cursorRenderer = new CursorRenderer(container, 18, 10);
    this.selectionRenderer = new SelectionRenderer(container, 18, 10);
    this.viewport = new ViewportManager(canvas.height);
    this.highlighter = new SyntaxHighlighter();
    this.screenReader = new ScreenReaderSupport(container);
    this.ariaManager = new AriaManager();
    this.selectionManager = new SelectionManager();
    this.monospaceOpt = new MonospaceOptimizer();
    this.widthCache = new LineWidthCache();
    this.layerHinting = new LayerHinting();

    this.inputHandler = new InputHandler(this, this.screenReader.getTextarea());
  }

  async initialize(content: string): Promise<void> {
    this.document = new Document(content);

    await this.renderer.initialize();

    // Update cursor and selection dimensions to match renderer
    this.cursorRenderer.updateDimensions(
      this.renderer.getLineHeight(),
      this.renderer.getCharWidth()
    );

    this.selectionRenderer.updateDimensions(
      this.renderer.getLineHeight(),
      this.renderer.getCharWidth()
    );

    this.layerHinting.applyHint(this.canvas);

    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const render = () => {
      if (this.needsRender) {
        this.needsRender = false;

        const visibleRange = this.viewport.getVisibleLineRange(this.scrollTop, this.document.getLineCount());

        const visibleLines = [];
        const lineContent: string[] = [];
        
        for (let i = visibleRange.startLine; i <= visibleRange.endLine; i++) {
          const line = this.document.getLine(i);
          const tokens = this.highlighter.getCachedTokens(i, line, 'javascript');
          visibleLines.push({ line, tokens, lineNumber: i });
          lineContent[i] = line;
        }

        this.renderer.render(visibleLines, this.scrollTop);

        // Render selection (must be before cursor)
        this.selectionRenderer.render(this.selectionManager, this.scrollTop, lineContent);

        // Render cursor
        this.cursorRenderer.render(this.cursorLine, this.cursorColumn, this.scrollTop);

        this.screenReader.updateContent(this.document, this.cursorLine);

        this.ariaManager.updateAttributes(this.canvas, {
          cursorLine: this.cursorLine,
          cursorColumn: this.cursorColumn,
          lineCount: this.document.getLineCount(),
          hasSelection: this.selectionManager.hasSelection(),
        });
      }

      requestAnimationFrame(render);
    };

    this.needsRender = true;
    requestAnimationFrame(render);
  }

  private requestRender(): void {
    this.needsRender = true;
  }

  insertText(text: string): void {
    this.document.insertText(this.cursorLine, this.cursorColumn, text);

    if (text === '\n') {
      this.cursorLine++;
      this.cursorColumn = 0;
    } else {
      this.cursorColumn += text.length;
    }

    this.widthCache.invalidateLine(this.cursorLine);
    this.highlighter.invalidateCache(this.cursorLine, this.cursorLine);
    this.selectionManager.clearSelection();
    this.requestRender();
  }

  deleteText(count: number): void {
    if (this.cursorColumn === 0 && this.cursorLine === 0) return;

    if (this.cursorColumn > 0) {
      this.document.deleteText({
        startLine: this.cursorLine,
        startColumn: this.cursorColumn - count,
        endLine: this.cursorLine,
        endColumn: this.cursorColumn,
      });
      this.cursorColumn = Math.max(0, this.cursorColumn - count);
    } else {
      this.cursorLine--;
      const prevLineLength = this.document.getLine(this.cursorLine).length;
      this.cursorColumn = prevLineLength;
      this.document.deleteText({
        startLine: this.cursorLine,
        startColumn: prevLineLength,
        endLine: this.cursorLine + 1,
        endColumn: 0,
      });
    }

    this.widthCache.invalidateLine(this.cursorLine);
    this.highlighter.invalidateCache(this.cursorLine, this.cursorLine);
    this.selectionManager.clearSelection();
    this.requestRender();
  }

  moveCursor(deltaLine: number, deltaCol: number): void {
    this.cursorLine = Math.max(0, Math.min(this.document.getLineCount() - 1, this.cursorLine + deltaLine));

    const currentLine = this.document.getLine(this.cursorLine);

    if (deltaCol === Infinity) {
      this.cursorColumn = currentLine.length;
    } else if (deltaCol === -Infinity) {
      this.cursorColumn = 0;
    } else {
      this.cursorColumn = Math.max(0, Math.min(currentLine.length, this.cursorColumn + deltaCol));
    }

    this.selectionManager.clearSelection();
    this.requestRender();
  }

  moveCursorWithSelection(deltaLine: number, deltaCol: number): void {
    // Start selection if not already active
    if (!this.selectionManager.hasSelection()) {
      this.selectionManager.startSelection({
        line: this.cursorLine,
        column: this.cursorColumn,
      });
    }

    // Move cursor
    this.cursorLine = Math.max(0, Math.min(this.document.getLineCount() - 1, this.cursorLine + deltaLine));

    const currentLine = this.document.getLine(this.cursorLine);

    if (deltaCol === Infinity) {
      this.cursorColumn = currentLine.length;
    } else if (deltaCol === -Infinity) {
      this.cursorColumn = 0;
    } else {
      this.cursorColumn = Math.max(0, Math.min(currentLine.length, this.cursorColumn + deltaCol));
    }

    // Update selection to new cursor position
    this.selectionManager.updateSelection({
      line: this.cursorLine,
      column: this.cursorColumn,
    });

    this.requestRender();
  }

  getCursorPosition(): { line: number; column: number } {
    return {
      line: this.cursorLine,
      column: this.cursorColumn,
    };
  }

  setCursorPosition(line: number, column: number): void {
    // Clamp line to valid range
    this.cursorLine = Math.max(0, Math.min(this.document.getLineCount() - 1, line));

    // Clamp column to valid range for the line
    const currentLine = this.document.getLine(this.cursorLine);
    this.cursorColumn = Math.max(0, Math.min(currentLine.length, column));

    this.selectionManager.clearSelection();
    this.requestRender();
  }

  setCursorPositionWithoutClearingSelection(line: number, column: number): void {
    // Clamp line to valid range
    this.cursorLine = Math.max(0, Math.min(this.document.getLineCount() - 1, line));

    // Clamp column to valid range for the line
    const currentLine = this.document.getLine(this.cursorLine);
    this.cursorColumn = Math.max(0, Math.min(currentLine.length, column));

    this.requestRender();
  }

  scroll(deltaY: number): void {
    const maxScroll = this.viewport.getTotalHeight(this.document.getLineCount()) - this.canvas.height;
    this.scrollTop = Math.max(0, Math.min(maxScroll, this.scrollTop + deltaY));
    this.requestRender();
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getScrollTop(): number {
    return this.scrollTop;
  }

  getLineHeight(): number {
    return this.renderer.getLineHeight();
  }

  getCharWidth(): number {
    return this.renderer.getCharWidth();
  }

  startSelection(line: number, column: number): void {
    // Clamp to valid position
    const clampedLine = Math.max(0, Math.min(this.document.getLineCount() - 1, line));
    const currentLine = this.document.getLine(clampedLine);
    const clampedColumn = Math.max(0, Math.min(currentLine.length, column));

    this.selectionManager.startSelection({
      line: clampedLine,
      column: clampedColumn,
    });
    this.requestRender();
  }

  updateSelection(line: number, column: number): void {
    // Clamp to valid position
    const clampedLine = Math.max(0, Math.min(this.document.getLineCount() - 1, line));
    const currentLine = this.document.getLine(clampedLine);
    const clampedColumn = Math.max(0, Math.min(currentLine.length, column));

    this.selectionManager.updateSelection({
      line: clampedLine,
      column: clampedColumn,
    });
    this.requestRender();
  }

  clearSelection(): void {
    this.selectionManager.clearSelection();
    this.requestRender();
  }

  getSelectionManager(): SelectionManager {
    return this.selectionManager;
  }
}
