# Fixed WebGPU Renderer Implementation

This is the corrected implementation using VS Code's instanced rendering approach.

## Key Changes Summary

1. **Storage buffers** instead of per-character vertex buffers
2. **Texture array** for glyph atlas (all pages in one texture)
3. **Instanced rendering** (one draw call for all visible glyphs)
4. **Shared quad vertices** (one buffer for all glyphs)

---

## Fixed Shader (glyph.wgsl)

```wgsl
// Structures
struct LayoutInfo {
  canvasDims: vec2f,
  viewportOffset: vec2f,
  viewportDims: vec2f,
}

struct GlyphInfo {
  position: vec2f,    // Position in atlas texture
  size: vec2f,        // Size in atlas texture
  origin: vec2f,      // Origin offset for rendering
}

struct Cell {
  position: vec2f,    // Screen position (x, y)
  unused: vec2f,      // Padding for alignment
  glyphIndex: f32,    // Index into glyphInfo array
  textureLayer: f32,  // Which atlas page (texture array layer)
}

struct VertexInput {
  @location(0) position: vec2f,  // Shared quad vertex (0-1 range)
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texCoord: vec2f,
  @location(1) layerIndex: u32,
}

// Bindings
@group(0) @binding(0) var<uniform> layoutInfo: LayoutInfo;
@group(0) @binding(1) var<uniform> atlasDims: vec2f;
@group(0) @binding(2) var<storage, read> glyphInfo: array<array<GlyphInfo, 4096>, 2>;  // [pages][glyphs per page]
@group(0) @binding(3) var<storage, read> cells: array<Cell>;
@group(0) @binding(4) var glyphTexture: texture_2d_array<f32>;
@group(0) @binding(5) var glyphSampler: sampler;

@vertex
fn vs_main(
  vertex: VertexInput,
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32
) -> VertexOutput {
  // Get cell data for this instance
  let cell = cells[instanceIndex];

  // Get glyph info from storage buffer
  let textureLayer = u32(cell.textureLayer);
  let glyphIdx = u32(cell.glyphIndex);
  let glyph = glyphInfo[textureLayer][glyphIdx];

  // Calculate screen position
  // vertex.position is 0-1 quad, scale by glyph size
  let screenPos = cell.position + (vertex.position * glyph.size) + glyph.origin;

  // Convert to clip space (-1 to 1)
  let clipPos = vec2f(
    (screenPos.x / layoutInfo.canvasDims.x) * 2.0 - 1.0,
    1.0 - (screenPos.y / layoutInfo.canvasDims.y) * 2.0
  );

  // Calculate texture coordinates
  let texCoord = (glyph.position + vertex.position * glyph.size) / atlasDims;

  var output: VertexOutput;
  output.position = vec4f(clipPos, 0.0, 1.0);
  output.texCoord = texCoord;
  output.layerIndex = textureLayer;
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Sample from texture array using layer index
  return textureSample(glyphTexture, glyphSampler, input.texCoord, input.layerIndex);
}
```

---

## Fixed TypeScript Implementation

```typescript
// WebGPURenderer.ts (corrected version)

interface Cell {
  positionX: number;
  positionY: number;
  unused1: number;
  unused2: number;
  glyphIndex: number;
  textureLayer: number;
}

const FLOATS_PER_CELL = 6;
const MAX_VISIBLE_GLYPHS = 10000; // Conservative estimate

export class WebGPURendererFixed {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private bindGroup!: GPUBindGroup;

  // Storage buffers
  private cellStorageBuffer!: GPUBuffer;
  private glyphInfoStorageBuffer!: GPUBuffer;

  // Uniform buffers
  private layoutInfoBuffer!: GPUBuffer;
  private atlasDimsBuffer!: GPUBuffer;

  // Shared vertex buffer (one quad for all glyphs)
  private quadVertexBuffer!: GPUBuffer;

  // Texture atlas
  private atlasTexture!: GPUTexture;
  private sampler!: GPUSampler;

  private textureAtlas: TextureAtlas;

  constructor(private canvas: HTMLCanvasElement) {
    this.textureAtlas = new TextureAtlas(/* ... */);
  }

  async initialize(): Promise<void> {
    // ... GPU adapter setup ...

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
    const maxGlyphsPerPage = 4096;
    const maxPages = 2;
    const floatsPerGlyph = 6; // position(2) + size(2) + origin(2)
    this.glyphInfoStorageBuffer = this.device.createBuffer({
      size: maxPages * maxGlyphsPerPage * floatsPerGlyph * Float32Array.BYTES_PER_ELEMENT,
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
    this.atlasTexture = this.device.createTexture({
      size: { width: 2048, height: 2048, depthOrArrayLayers: 2 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      dimension: '2d',
    });

    this.sampler = this.device.createSampler({
      magFilter: 'nearest',  // VS Code uses 'nearest' for crisp text
      minFilter: 'nearest',
    });

    await this.createPipeline();
    this.createBindGroup();
    this.uploadAtlasData();
  }

  private async createPipeline(): Promise<void> {
    const shaderCode = await fetch('/shaders/glyph.wgsl').then(r => r.text());
    const shaderModule = this.device.createShaderModule({ code: shaderCode });

    this.pipeline = this.device.createRenderPipeline({
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
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.layoutInfoBuffer } },
        { binding: 1, resource: { buffer: this.atlasDimsBuffer } },
        { binding: 2, resource: { buffer: this.glyphInfoStorageBuffer } },
        { binding: 3, resource: { buffer: this.cellStorageBuffer } },
        { binding: 4, resource: this.atlasTexture.createView() },
        { binding: 5, resource: this.sampler },
      ],
    });
  }

  private uploadAtlasData(): void {
    // Upload atlas dimensions
    const atlasDims = new Float32Array([2048, 2048]);
    this.device.queue.writeBuffer(this.atlasDimsBuffer, 0, atlasDims);

    // Upload glyph info from texture atlas
    // This would be populated from your TextureAtlas class
    const glyphInfoData = this.textureAtlas.getGlyphInfoArray();
    this.device.queue.writeBuffer(this.glyphInfoStorageBuffer, 0, glyphInfoData);

    // Upload atlas texture data
    for (let layer = 0; layer < this.textureAtlas.getPageCount(); layer++) {
      const pageData = this.textureAtlas.getPageImageData(layer);
      this.device.queue.copyExternalImageToTexture(
        { source: pageData },
        { texture: this.atlasTexture, origin: { x: 0, y: 0, z: layer } },
        { width: 2048, height: 2048 }
      );
    }
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
      const y = (lineData.lineNumber * 18) - scrollTop; // 18 = line height

      for (let i = 0; i < lineData.line.length && glyphCount < MAX_VISIBLE_GLYPHS; i++) {
        const char = lineData.line[i];
        const glyph = this.textureAtlas.getGlyph(char, style);
        const x = i * 10; // 10 = char width

        // Fill cell entry
        cellData[cellIndex++] = x;                  // positionX
        cellData[cellIndex++] = y;                  // positionY
        cellData[cellIndex++] = 0;                  // unused1
        cellData[cellIndex++] = 0;                  // unused2
        cellData[cellIndex++] = glyph.index;        // glyphIndex
        cellData[cellIndex++] = glyph.page;         // textureLayer

        glyphCount++;
      }
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
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
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
```

---

## TextureAtlas Changes

You'll need to update your TextureAtlas to support:

1. **Glyph indices** instead of just coordinates
2. **Array for glyph info** that can be uploaded to storage buffer

```typescript
interface CachedGlyph {
  page: number;      // Which texture array layer
  index: number;     // Index within that page's glyph array
  x: number;         // Position in atlas
  y: number;
  width: number;
  height: number;
  offsetX: number;   // Origin offset
  offsetY: number;
}

class TextureAtlas {
  private glyphCache: Map<string, CachedGlyph> = new Map();
  private pages: TextureAtlasPage[] = [];

  getGlyphInfoArray(): Float32Array {
    // Build array for storage buffer upload
    const maxGlyphsPerPage = 4096;
    const floatsPerGlyph = 6;
    const data = new Float32Array(this.pages.length * maxGlyphsPerPage * floatsPerGlyph);

    for (let pageIdx = 0; pageIdx < this.pages.length; pageIdx++) {
      const page = this.pages[pageIdx];
      const glyphs = page.getAllGlyphs();

      for (let glyphIdx = 0; glyphIdx < glyphs.length; glyphIdx++) {
        const glyph = glyphs[glyphIdx];
        const offset = (pageIdx * maxGlyphsPerPage + glyphIdx) * floatsPerGlyph;

        data[offset + 0] = glyph.x;         // position.x
        data[offset + 1] = glyph.y;         // position.y
        data[offset + 2] = glyph.width;     // size.x
        data[offset + 3] = glyph.height;    // size.y
        data[offset + 4] = glyph.offsetX;   // origin.x
        data[offset + 5] = glyph.offsetY;   // origin.y
      }
    }

    return data;
  }

  getPageImageData(pageIndex: number): ImageBitmap {
    return this.pages[pageIndex].getImageBitmap();
  }
}
```

---

## Expected Performance

With this implementation:

- **4,000 characters**: 1 draw call (was 4,000)
- **Buffer allocations per frame**: 0 (was 4,000)
- **Bind group creations per frame**: 0 (was 4,000)
- **Frame time**: ~2-3ms → 60 FPS easily achievable
- **Memory**: Constant (pre-allocated buffers)

---

## Key Takeaways

1. **Instancing is critical** - Don't create resources per object
2. **Storage buffers** - Put all data in one place
3. **Texture arrays** - Avoid switching textures mid-render
4. **Batch everything** - One draw call per frame minimum

This is the fundamental difference between a slow WebGPU renderer and a fast one!
