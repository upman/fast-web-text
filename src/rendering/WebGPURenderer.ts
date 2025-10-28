import { TextureAtlas, GlyphStyle } from './TextureAtlas';
import { MonospaceOptimizer } from '../optimizations/MonospaceOptimizer';
import { LineWidthCache } from '../optimizations/LineWidthCache';

interface LineData {
  line: string;
  tokens: Token[];
  lineNumber: number;
}

interface Token {
  type: string;
  content: string;
  startColumn: number;
  endColumn: number;
}

const FLOATS_PER_CELL = 6;
const MAX_VISIBLE_GLYPHS = 10000; // Conservative estimate for visible characters

export class WebGPURenderer {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;
  private canvas: HTMLCanvasElement;

  // Storage buffers
  private cellStorageBuffer!: GPUBuffer;
  private glyphInfoStorageBuffer!: GPUBuffer;

  // Uniform buffers
  private layoutInfoBuffer!: GPUBuffer;
  private atlasDimsBuffer!: GPUBuffer;

  // Shared vertex buffer (one quad for all glyphs)
  private quadVertexBuffer!: GPUBuffer;

  // Texture atlas
  private textureAtlas!: TextureAtlas;
  private atlasTexture!: GPUTexture;
  private sampler!: GPUSampler;

  private lineHeight: number = 18;
  private charWidth: number = 10;
  private monospaceOpt: MonospaceOptimizer;
  private widthCache: LineWidthCache;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.monospaceOpt = new MonospaceOptimizer();
    this.widthCache = new LineWidthCache();
  }

  async initialize(): Promise<void> {
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported');
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No GPU adapter found');
    }

    this.device = await adapter.requestDevice();

    const context = this.canvas.getContext('webgpu');
    if (!context) {
      throw new Error('Failed to get WebGPU context');
    }
    this.context = context;

    this.context.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'premultiplied',
    });

    // Create texture atlas and pre-populate with common characters
    this.textureAtlas = new TextureAtlas(this.device, 2048);
    await this.prewarmAtlas();

    // Create shared quad vertices (used by all glyph instances)
    const quadVertices = new Float32Array([
      0.0, 0.0,  // top-left
      1.0, 0.0,  // top-right
      0.0, 1.0,  // bottom-left
      0.0, 1.0,  // bottom-left
      1.0, 0.0,  // top-right
      1.0, 1.0,  // bottom-right
    ]);

    this.quadVertexBuffer = this.device.createBuffer({
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX,
      mappedAtCreation: true,
    });
    new Float32Array(this.quadVertexBuffer.getMappedRange()).set(quadVertices);
    this.quadVertexBuffer.unmap();

    // Create cell storage buffer (holds all visible glyphs)
    this.cellStorageBuffer = this.device.createBuffer({
      size: MAX_VISIBLE_GLYPHS * FLOATS_PER_CELL * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Create glyph info storage buffer (glyph metadata from atlas)
    const maxGlyphs = 10000; // Should be enough for most cases
    const floatsPerGlyph = 6; // position(2) + size(2) + origin(2)
    this.glyphInfoStorageBuffer = this.device.createBuffer({
      size: maxGlyphs * floatsPerGlyph * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    // Create uniform buffers
    this.layoutInfoBuffer = this.device.createBuffer({
      size: 6 * Float32Array.BYTES_PER_ELEMENT, // 6 floats
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.atlasDimsBuffer = this.device.createBuffer({
      size: 2 * Float32Array.BYTES_PER_ELEMENT,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Create texture array for atlas pages
    this.atlasTexture = this.textureAtlas.createTextureArray(this.device);

    this.sampler = this.device.createSampler({
      magFilter: 'nearest',  // VS Code uses 'nearest' for crisp text
      minFilter: 'nearest',
    });

    await this.createRenderPipeline();
    this.createBindGroup();
    await this.uploadAtlasData();

    this.monospaceOpt.detectMonospace('monospace', 14);
    if (this.monospaceOpt.getIsMonospace()) {
      this.charWidth = this.monospaceOpt.getCharWidth();
    }
  }

  private async prewarmAtlas(): Promise<void> {
    // Pre-cache common ASCII characters
    const style: GlyphStyle = {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#FFFFFF',
      bold: false,
      italic: false,
    };

    const chars = ' ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:\'",.<>?/\\`~';
    for (const char of chars) {
      this.textureAtlas.getGlyph(char, style);
    }
  }

  private async createRenderPipeline(): Promise<void> {
    // Load shader from file
    const shaderResponse = await fetch('/src/shaders/glyph.wgsl');
    const shaderCode = await shaderResponse.text();

    const shaderModule = this.device.createShaderModule({
      label: 'Glyph shader',
      code: shaderCode
    });

    this.pipeline = this.device.createRenderPipeline({
      label: 'Glyph render pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' }, // quad position
          ],
        }],
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: navigator.gpu.getPreferredCanvasFormat(),
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
            },
          },
        }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });
  }

  private createBindGroup(): void {
    this.bindGroup = this.device.createBindGroup({
      label: 'Glyph bind group',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.layoutInfoBuffer } },
        { binding: 1, resource: { buffer: this.atlasDimsBuffer } },
        { binding: 2, resource: { buffer: this.glyphInfoStorageBuffer } },
        { binding: 3, resource: { buffer: this.cellStorageBuffer } },
        { binding: 4, resource: this.atlasTexture.createView({ dimension: '2d-array' }) },
        { binding: 5, resource: this.sampler },
      ],
    });
  }

  private async uploadAtlasData(): Promise<void> {
    // Upload atlas dimensions
    const atlasDims = new Float32Array([2048, 2048]);
    this.device.queue.writeBuffer(this.atlasDimsBuffer, 0, atlasDims);

    // Upload glyph info from texture atlas
    const glyphInfoData = this.textureAtlas.getGlyphInfoArray();
    this.device.queue.writeBuffer(this.glyphInfoStorageBuffer, 0, glyphInfoData);

    // Copy atlas pages to texture array
    await this.textureAtlas.copyPagesToTextureArray(this.device, this.atlasTexture);
  }

  render(visibleLines: LineData[], scrollTop: number): void {
    // Update layout uniforms
    const layoutInfo = new Float32Array([
      this.canvas.width,  // canvasDims.x
      this.canvas.height, // canvasDims.y
      0,                  // viewportOffset.x
      0,                  // viewportOffset.y
      this.canvas.width,  // viewportDims.x
      this.canvas.height, // viewportDims.y
    ]);
    this.device.queue.writeBuffer(this.layoutInfoBuffer, 0, layoutInfo);

    // Build cell data for all visible glyphs
    const cellData = new Float32Array(MAX_VISIBLE_GLYPHS * FLOATS_PER_CELL);
    let cellIndex = 0;
    let glyphCount = 0;

    const style: GlyphStyle = {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#FFFFFF',
      bold: false,
      italic: false,
    };

    for (const lineData of visibleLines) {
      const y = (lineData.lineNumber * this.lineHeight) - scrollTop;

      // Skip lines that are off-screen
      if (y + this.lineHeight < 0 || y > this.canvas.height) {
        continue;
      }

      for (let i = 0; i < lineData.line.length && glyphCount < MAX_VISIBLE_GLYPHS; i++) {
        const char = lineData.line[i];

        // Skip whitespace for performance (or render as space)
        if (char === ' ') {
          continue;
        }

        const glyph = this.textureAtlas.getGlyph(char, style);
        const x = i * this.charWidth;

        // Fill cell entry
        cellData[cellIndex++] = x;              // positionX
        cellData[cellIndex++] = y;              // positionY
        cellData[cellIndex++] = 0;              // unused1
        cellData[cellIndex++] = 0;              // unused2
        cellData[cellIndex++] = glyph.index;    // glyphIndex
        cellData[cellIndex++] = glyph.page;     // textureLayer

        glyphCount++;
      }
    }

    // Early exit if nothing to render
    if (glyphCount === 0) {
      return;
    }

    // Upload cell data to GPU (ONE write)
    this.device.queue.writeBuffer(
      this.cellStorageBuffer,
      0,
      cellData,
      0,
      glyphCount * FLOATS_PER_CELL
    );

    // Render with ONE draw call
    const commandEncoder = this.device.createCommandEncoder({ label: 'Glyph render encoder' });
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      label: 'Glyph render pass',
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, this.bindGroup);
    renderPass.setVertexBuffer(0, this.quadVertexBuffer);

    // ONE instanced draw call for all glyphs
    renderPass.draw(
      6,           // vertices per instance (quad)
      glyphCount,  // instance count (number of glyphs)
      0,           // first vertex
      0            // first instance
    );

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
}
