import { Token } from './SyntaxHighlighter';

export class TokenCache {
  private cache: Map<number, Token[]> = new Map();

  get(lineNumber: number): Token[] | undefined {
    return this.cache.get(lineNumber);
  }

  set(lineNumber: number, tokens: Token[]): void {
    this.cache.set(lineNumber, tokens);
  }

  has(lineNumber: number): boolean {
    return this.cache.has(lineNumber);
  }

  invalidate(lineNumber: number): void {
    this.cache.delete(lineNumber);
  }

  invalidateRange(fromLine: number, toLine: number): void {
    for (let i = fromLine; i <= toLine; i++) {
      this.cache.delete(i);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}
