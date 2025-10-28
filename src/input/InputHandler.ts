export interface Editor {
  insertText(text: string): void;
  deleteText(count: number): void;
  moveCursor(deltaLine: number, deltaCol: number): void;
  scroll(deltaY: number): void;
  getCanvas(): HTMLCanvasElement;
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
    });

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
  }

  private handleScroll(e: WheelEvent): void {
    e.preventDefault();
    this.editor.scroll(e.deltaY);
  }
}
