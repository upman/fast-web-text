/**
 * CursorRenderer - DOM-based cursor overlay
 * Renders a blinking cursor similar to VS Code's implementation
 */
export class CursorRenderer {
  private cursorElement: HTMLDivElement;
  private blinkInterval: number | null = null;
  private isVisible: boolean = true;
  private lineHeight: number;
  private charWidth: number;

  constructor(container: HTMLElement, lineHeight: number = 18, charWidth: number = 10) {
    this.lineHeight = lineHeight;
    this.charWidth = charWidth;

    // Create cursor element
    this.cursorElement = document.createElement('div');
    this.cursorElement.className = 'cursor';
    this.setupStyles();
    container.appendChild(this.cursorElement);

    this.startBlinking();
  }

  private setupStyles(): void {
    const style = this.cursorElement.style;
    style.position = 'absolute';
    style.width = '2px';
    style.height = `${this.lineHeight}px`;
    style.backgroundColor = '#ffffff';
    style.pointerEvents = 'none';
    style.zIndex = '100';
    style.transition = 'opacity 0.1s ease-in-out';
    style.willChange = 'opacity, transform';
  }

  /**
   * Update cursor position
   * @param line - Zero-based line number
   * @param column - Zero-based column number
   * @param scrollTop - Current scroll offset
   */
  render(line: number, column: number, scrollTop: number): void {
    const x = column * this.charWidth;
    const y = line * this.lineHeight - scrollTop;

    this.cursorElement.style.left = `${x}px`;
    this.cursorElement.style.top = `${y}px`;

    // Show cursor immediately on position change (reset blink)
    this.resetBlink();

    // Check if cursor is in viewport
    const canvas = this.cursorElement.parentElement;
    if (canvas) {
      const inViewport = y >= 0 && y < canvas.clientHeight;
      this.cursorElement.style.display = inViewport ? 'block' : 'none';
    }
  }

  /**
   * Update cursor dimensions when font changes
   */
  updateDimensions(lineHeight: number, charWidth: number): void {
    this.lineHeight = lineHeight;
    this.charWidth = charWidth;
    this.cursorElement.style.height = `${lineHeight}px`;
  }

  /**
   * Start cursor blinking animation
   */
  private startBlinking(): void {
    if (this.blinkInterval !== null) {
      return;
    }

    // Blink every 500ms (VS Code's default)
    this.blinkInterval = window.setInterval(() => {
      this.isVisible = !this.isVisible;
      this.cursorElement.style.opacity = this.isVisible ? '1' : '0';
    }, 500);
  }

  /**
   * Stop cursor blinking
   */
  stopBlinking(): void {
    if (this.blinkInterval !== null) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
    this.cursorElement.style.opacity = '1';
    this.isVisible = true;
  }

  /**
   * Reset blink cycle (show cursor immediately)
   */
  private resetBlink(): void {
    this.stopBlinking();
    this.cursorElement.style.opacity = '1';
    this.isVisible = true;
    this.startBlinking();
  }

  /**
   * Show cursor
   */
  show(): void {
    this.cursorElement.style.display = 'block';
    this.startBlinking();
  }

  /**
   * Hide cursor
   */
  hide(): void {
    this.cursorElement.style.display = 'none';
    this.stopBlinking();
  }

  /**
   * Cleanup
   */
  dispose(): void {
    this.stopBlinking();
    this.cursorElement.remove();
  }
}
