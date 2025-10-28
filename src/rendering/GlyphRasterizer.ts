import { GlyphStyle } from './TextureAtlas';

export class GlyphRasterizer {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;

  constructor() {
    this.canvas = new OffscreenCanvas(128, 128);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
  }

  rasterize(char: string, style: GlyphStyle): ImageData {
    this.ctx.clearRect(0, 0, 128, 128);

    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';

    const fontStr = `${style.bold ? 'bold ' : ''}${style.italic ? 'italic ' : ''}${style.fontSize}px ${style.fontFamily}`;
    this.ctx.font = fontStr;
    this.ctx.fillStyle = style.color;
    this.ctx.textBaseline = 'top';

    this.ctx.fillText(char, 0, 0);

    const metrics = this.ctx.measureText(char);
    const width = Math.ceil(metrics.width);
    const height = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);

    return this.ctx.getImageData(0, 0, width, height);
  }
}
