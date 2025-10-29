export interface Editor {
  insertText(text: string): void;
  deleteText(count: number): void;
  moveCursor(deltaLine: number, deltaCol: number): void;
  moveCursorWithSelection(deltaLine: number, deltaCol: number): void;
  setCursorPosition(line: number, column: number): void;
  setCursorPositionWithoutClearingSelection(line: number, column: number): void;
  scroll(deltaY: number): void;
  getCanvas(): HTMLCanvasElement;
  getScrollTop(): number;
  getLineHeight(): number;
  getCharWidth(): number;
  startSelection(line: number, column: number): void;
  updateSelection(line: number, column: number): void;
  clearSelection(): void;
  getCursorPosition(): { line: number; column: number };
}

export class InputHandler {
  private editor: Editor;
  private textarea: HTMLTextAreaElement;
  private isMouseDown: boolean = false;
  private isDragging: boolean = false;

  constructor(editor: Editor, textarea: HTMLTextAreaElement) {
    this.editor = editor;
    this.textarea = textarea;
    this.setupListeners();
  }

  private setupListeners(): void {
    this.textarea.addEventListener('input', (e) => {
      this.handleInput(e);
    });

    this.textarea.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    const canvas = this.editor.getCanvas();

    canvas.addEventListener('click', (e) => {
      this.handleClick(e);
    });

    canvas.addEventListener('mousedown', (e) => {
      this.handleMouseDown(e);
    });

    canvas.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e);
    });

    canvas.addEventListener('mouseup', (e) => {
      this.handleMouseUp(e);
    });

    canvas.addEventListener('mouseleave', (e) => {
      this.handleMouseLeave(e);
    });

    canvas.addEventListener('wheel', (e) => {
      this.handleScroll(e);
    }, { passive: true });
  }

  private handleInput(e: Event): void {
    const input = e as InputEvent;
    if (input.data) {
      this.editor.insertText(input.data);
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
    // Handle Shift+Arrow keys for selection
    if (e.shiftKey) {
      switch (e.key) {
        case 'ArrowUp':
          this.editor.moveCursorWithSelection(-1, 0);
          e.preventDefault();
          return;
        case 'ArrowDown':
          this.editor.moveCursorWithSelection(1, 0);
          e.preventDefault();
          return;
        case 'ArrowLeft':
          this.editor.moveCursorWithSelection(0, -1);
          e.preventDefault();
          return;
        case 'ArrowRight':
          this.editor.moveCursorWithSelection(0, 1);
          e.preventDefault();
          return;
        case 'Home':
          this.editor.moveCursorWithSelection(0, -Infinity);
          e.preventDefault();
          return;
        case 'End':
          this.editor.moveCursorWithSelection(0, Infinity);
          e.preventDefault();
          return;
      }
    }

    switch (e.key) {
      case 'ArrowUp':
        this.editor.moveCursor(-1, 0);
        e.preventDefault();
        break;

      case 'ArrowDown':
        this.editor.moveCursor(1, 0);
        e.preventDefault();
        break;

      case 'ArrowLeft':
        this.editor.moveCursor(0, -1);
        e.preventDefault();
        break;

      case 'ArrowRight':
        this.editor.moveCursor(0, 1);
        e.preventDefault();
        break;

      case 'Home':
        this.editor.moveCursor(0, -Infinity);
        e.preventDefault();
        break;

      case 'End':
        this.editor.moveCursor(0, Infinity);
        e.preventDefault();
        break;

      case 'Backspace':
        this.editor.deleteText(1);
        e.preventDefault();
        break;

      case 'Delete':
        this.editor.deleteText(1);
        e.preventDefault();
        break;

      case 'Enter':
        this.editor.insertText('\n');
        e.preventDefault();
        break;

      case 'Tab':
        this.editor.insertText('  ');
        e.preventDefault();
        break;
    }
  }

  private handleClick(e: MouseEvent): void {
    this.textarea.focus();

    // If we just finished dragging, don't process click (selection already made)
    // Note: isDragging is still true here because click fires after mouseup
    if (this.isDragging) {
      this.isDragging = false; // Reset here after preventing the click action
      return;
    }

    // If shift is held, extend selection
    if (e.shiftKey) {
      const position = this.getMousePosition(e);
      this.editor.updateSelection(position.line, position.column);
      return;
    }

    // Normal click - clear selection and set cursor
    const position = this.getMousePosition(e);
    this.editor.setCursorPosition(position.line, position.column);
  }

  private handleMouseDown(e: MouseEvent): void {
    this.textarea.focus();
    this.isMouseDown = true;
    // Don't reset isDragging here - let it be set during mousemove

    // Don't start selection on shift+click (handled in click event)
    if (e.shiftKey) {
      return;
    }

    const position = this.getMousePosition(e);
    this.editor.startSelection(position.line, position.column);
    this.editor.setCursorPositionWithoutClearingSelection(position.line, position.column);
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.isMouseDown) {
      return;
    }

    this.isDragging = true;
    const position = this.getMousePosition(e);
    this.editor.updateSelection(position.line, position.column);
    this.editor.setCursorPositionWithoutClearingSelection(position.line, position.column);
  }

  private handleMouseUp(e: MouseEvent): void {
    this.isMouseDown = false;
    // Don't reset isDragging here - let it be reset in click handler
  }

  private handleMouseLeave(e: MouseEvent): void {
    // If mouse leaves while dragging, stop the drag
    if (this.isMouseDown) {
      this.isMouseDown = false;
      // Keep isDragging true so click handler knows we were dragging
    }
  }

  private getMousePosition(e: MouseEvent): { line: number; column: number } {
    // Calculate cursor position from click coordinates
    const canvas = this.editor.getCanvas();
    const rect = canvas.getBoundingClientRect();

    // Get click position relative to canvas (in CSS pixels)
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Account for scroll position
    const scrollTop = this.editor.getScrollTop();

    // Calculate line and column
    const lineHeight = this.editor.getLineHeight();
    const charWidth = this.editor.getCharWidth();

    const line = Math.floor((y + scrollTop) / lineHeight);
    const column = Math.floor(x / charWidth);

    return { line, column };
  }

  private handleScroll(e: WheelEvent): void {
    e.preventDefault();
    this.editor.scroll(e.deltaY);
  }
}
