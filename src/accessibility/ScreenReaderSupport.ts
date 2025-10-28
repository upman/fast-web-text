import { Document } from '../core/Document';

export class ScreenReaderSupport {
  private textarea: HTMLTextAreaElement;
  private currentLine: number = 0;
  private pageSize: number = 50;

  constructor(container: HTMLElement) {
    this.textarea = this.createHiddenTextarea();
    container.appendChild(this.textarea);
    this.setupEventListeners();
  }

  private createHiddenTextarea(): HTMLTextAreaElement {
    const textarea = document.createElement('textarea');
    textarea.setAttribute('role', 'textbox');
    textarea.setAttribute('aria-multiline', 'true');
    textarea.setAttribute('aria-label', 'Code editor');

    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';

    return textarea;
  }

  private setupEventListeners(): void {
    this.textarea.addEventListener('focus', () => {
      this.textarea.setAttribute('aria-label', `Code editor focused, line ${this.currentLine + 1}`);
    });
  }

  updateContent(document: Document, cursorLine: number): void {
    this.currentLine = cursorLine;

    const startLine = Math.floor(cursorLine / this.pageSize) * this.pageSize;
    const endLine = Math.min(startLine + this.pageSize, document.getLineCount());

    const content: string[] = [];
    for (let i = startLine; i < endLine; i++) {
      content.push(document.getLine(i));
    }

    this.textarea.value = content.join('\n');

    const offsetInPage = cursorLine - startLine;
    let charOffset = 0;
    for (let i = 0; i < offsetInPage; i++) {
      charOffset += content[i].length + 1;
    }

    this.textarea.setSelectionRange(charOffset, charOffset);
  }

  getTextarea(): HTMLTextAreaElement {
    return this.textarea;
  }

  focus(): void {
    this.textarea.focus();
  }

  blur(): void {
    this.textarea.blur();
  }
}
