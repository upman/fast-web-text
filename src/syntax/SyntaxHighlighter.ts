import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-json';

export interface Token {
  type: string;
  content: string;
  startColumn: number;
  endColumn: number;
}

export class SyntaxHighlighter {
  private tokenCache: Map<number, Token[]> = new Map();

  tokenize(line: string, language: string): Token[] {
    const grammar = Prism.languages[language];
    if (!grammar) {
      return [{ type: 'plain', content: line, startColumn: 0, endColumn: line.length }];
    }

    const tokens = Prism.tokenize(line, grammar);
    return this.flattenTokens(tokens);
  }

  private flattenTokens(tokens: Array<string | Prism.Token>, startCol: number = 0): Token[] {
    const result: Token[] = [];

    for (const token of tokens) {
      if (typeof token === 'string') {
        result.push({
          type: 'plain',
          content: token,
          startColumn: startCol,
          endColumn: startCol + token.length,
        });
        startCol += token.length;
      } else {
        const content = this.getTokenContent(token);
        const type = typeof token.type === 'string' ? token.type : token.type[0];
        result.push({
          type,
          content,
          startColumn: startCol,
          endColumn: startCol + content.length,
        });
        startCol += content.length;
      }
    }

    return result;
  }

  private getTokenContent(token: Prism.Token): string {
    if (typeof token.content === 'string') {
      return token.content;
    }
    if (Array.isArray(token.content)) {
      return token.content.map(t =>
        typeof t === 'string' ? t : this.getTokenContent(t)
      ).join('');
    }
    return '';
  }

  getCachedTokens(lineNumber: number, line: string, language: string): Token[] {
    if (this.tokenCache.has(lineNumber)) {
      return this.tokenCache.get(lineNumber)!;
    }

    const tokens = this.tokenize(line, language);
    this.tokenCache.set(lineNumber, tokens);
    return tokens;
  }

  invalidateCache(fromLine: number, toLine: number): void {
    for (let i = fromLine; i <= toLine; i++) {
      this.tokenCache.delete(i);
    }
  }

  clearCache(): void {
    this.tokenCache.clear();
  }
}
