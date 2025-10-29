export interface Editor {
  insertText(text: string): void;
  deleteText(count: number): void;
  moveCursor(deltaLine: number, deltaCol: number): void;
  setCursorPosition(line: number, column: number): void;
  scroll(deltaY: number): void;
  getCanvas(): HTMLCanvasElement;
  getScrollTop(): number;
  getLineHeight(): number;
  getCharWidth(): number;
}

export class InputHandler {
  private editor: Editor;
  private textarea: HTMLTextAreaElement;

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

    canvas.addEventListener('wheel', (e) => {
      this.handleScroll(e);
    }, { passive: true });

    canvas.addEventListener('mousedown', (e) => {
      this.textarea.focus();
    });
  }

  private handleInput(e: Event): void {
    const input = e as InputEvent;
    if (input.data) {
      this.editor.insertText(input.data);
    }
  }

  private handleKeydown(e: KeyboardEvent): void {
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

    // Set cursor position
    this.editor.setCursorPosition(line, column);
  }

  private handleScroll(e: WheelEvent): void {
    e.preventDefault();
    this.editor.scroll(e.deltaY);
  }
}
