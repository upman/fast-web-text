import { GlyphRasterizer } from './GlyphRasterizer';

export interface GlyphStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

export interface CachedGlyph {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

class TextureAtlasPage {
  texture: GPUTexture;
  x: number = 0;
  y: number = 0;
  rowHeight: number = 0;

  constructor(device: GPUDevice, size: number) {
    this.texture = device.createTexture({
      size: [size, size],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
  }

  canFit(width: number, height: number, pageSize: number): boolean {
    if (this.x + width > pageSize) {
      this.x = 0;
      this.y += this.rowHeight;
      this.rowHeight = 0;
    }
    return this.y + height <= pageSize;
  }

  allocate(width: number, height: number): { x: number; y: number } {
    const result = { x: this.x, y: this.y };
    this.x += width;
    this.rowHeight = Math.max(this.rowHeight, height);
    return result;
  }
}

export class TextureAtlas {
  private pages: TextureAtlasPage[] = [];
  private glyphCache: Map<string, CachedGlyph> = new Map();
  private device: GPUDevice;
  private pageSize: number;
  private rasterizer: GlyphRasterizer;

  constructor(device: GPUDevice, pageSize: number = 2048) {
    this.device = device;
    this.pageSize = pageSize;
    this.rasterizer = new GlyphRasterizer();
    this.createNewPage();
  }

  private createNewPage(): void {
    this.pages.push(new TextureAtlasPage(this.device, this.pageSize));
  }

  getGlyph(char: string, style: GlyphStyle): CachedGlyph {
    const key = this.makeKey(char, style);

    if (this.glyphCache.has(key)) {
      return this.glyphCache.get(key)!;
    }

    const imageData = this.rasterizer.rasterize(char, style);
    return this.allocateGlyph(char, imageData, key);
  }

  private allocateGlyph(char: string, imageData: ImageData, key: string): CachedGlyph {
    const width = imageData.width;
    const height = imageData.height;

    let pageIndex = this.pages.length - 1;
    let page = this.pages[pageIndex];

    if (!page.canFit(width, height, this.pageSize)) {
      this.createNewPage();
      pageIndex = this.pages.length - 1;
      page = this.pages[pageIndex];
    }

    const { x, y } = page.allocate(width, height);

    this.device.queue.writeTexture(
      { texture: page.texture, origin: { x, y } },
      imageData.data,
      { bytesPerRow: width * 4 },
      { width, height }
    );

    const cached: CachedGlyph = {
      page: pageIndex,
      x,
      y,
      width,
      height,
      offsetX: 0,
      offsetY: 0,
    };

    this.glyphCache.set(key, cached);
    return cached;
  }

  private makeKey(char: string, style: GlyphStyle): string {
    return `${char}_${style.fontFamily}_${style.fontSize}_${style.color}_${style.bold}_${style.italic}`;
  }

  getTexture(page: number): GPUTexture {
    return this.pages[page].texture;
  }
}
