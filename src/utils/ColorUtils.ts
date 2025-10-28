export class ColorMapper {
  private colorMap: Map<string, string> = new Map([
    ['keyword', '#569CD6'],
    ['string', '#CE9178'],
    ['comment', '#6A9955'],
    ['function', '#DCDCAA'],
    ['number', '#B5CEA8'],
    ['operator', '#D4D4D4'],
    ['punctuation', '#D4D4D4'],
    ['boolean', '#569CD6'],
    ['constant', '#4FC1FF'],
    ['class-name', '#4EC9B0'],
    ['tag', '#569CD6'],
    ['attr-name', '#9CDCFE'],
    ['attr-value', '#CE9178'],
    ['plain', '#D4D4D4'],
  ]);

  getColor(tokenType: string): string {
    return this.colorMap.get(tokenType) || '#D4D4D4';
  }

  setColor(tokenType: string, color: string): void {
    this.colorMap.set(tokenType, color);
  }

  hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    } : { r: 1, g: 1, b: 1 };
  }

  rgbToFloat32Array(hex: string, alpha: number = 1.0): Float32Array {
    const rgb = this.hexToRgb(hex);
    return new Float32Array([rgb.r, rgb.g, rgb.b, alpha]);
  }
}
