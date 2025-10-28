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

export class WebGPURenderer {
  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private pipeline!: GPURenderPipeline;
  private canvas: HTMLCanvasElement;
  private uniformBuffer!: GPUBuffer;
  private textureAtlas!: TextureAtlas;
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

    this.textureAtlas = new TextureAtlas(this.device, 2048);

    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });

    await this.createRenderPipeline();
    this.createUniformBuffer();

    this.monospaceOpt.detectMonospace('monospace', 14);
    if (this.monospaceOpt.getIsMonospace()) {
      this.charWidth = this.monospaceOpt.getCharWidth();
    }
  }

  private async createRenderPipeline(): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      code: `
        struct VertexInput {
          @location(0) position: vec2<f32>,
          @location(1) texCoord: vec2<f32>,
        }

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) texCoord: vec2<f32>,
        }

        struct Uniforms {
          viewProjection: mat4x4<f32>,
          color: vec4<f32>,
        }

        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        @group(0) @binding(1) var glyphTexture: texture_2d<f32>;
        @group(0) @binding(2) var glyphSampler: sampler;

        @vertex
        fn vs_main(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          output.position = uniforms.viewProjection * vec4<f32>(input.position, 0.0, 1.0);
          output.texCoord = input.texCoord;
          return output;
        }

        @fragment
        fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
          let texColor = textureSample(glyphTexture, glyphSampler, input.texCoord);
          return texColor * uniforms.color;
        }
      `
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
              buffer: { type: 'uniform' }
            },
            {
              binding: 1,
              visibility: GPUShaderStage.FRAGMENT,
              texture: { sampleType: 'float' }
            },
            {
              binding: 2,
              visibility: GPUShaderStage.FRAGMENT,
              sampler: {}
            }
          ]
        })
      ]
    });

    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [
          {
            arrayStride: 16,
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },
              { shaderLocation: 1, offset: 8, format: 'float32x2' },
            ]
          }
        ]
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
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        }]
      },
      primitive: {
        topology: 'triangle-list',
      }
    });
  }

  private createUniformBuffer(): void {
    this.uniformBuffer = this.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private createVertexBuffer(vertices: Float32Array): GPUBuffer {
    const buffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(buffer, 0, vertices);
    return buffer;
  }

  render(visibleLines: LineData[], scrollTop: number): void {
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }]
    });

    const width = this.canvas.width;
    const height = this.canvas.height;
    const projection = this.createOrthographicProjection(width, height);

    renderPass.setPipeline(this.pipeline);

    const style: GlyphStyle = {
      fontFamily: 'monospace',
      fontSize: 14,
      color: '#FFFFFF',
      bold: false,
      italic: false,
    };

    for (const lineData of visibleLines) {
      const yOffset = (lineData.lineNumber * this.lineHeight) - scrollTop;

      let cachedWidth = this.widthCache.getLineWidth(lineData.lineNumber);
      if (cachedWidth === undefined) {
        cachedWidth = this.monospaceOpt.getIsMonospace()
          ? lineData.line.length * this.charWidth
          : this.monospaceOpt.getCharPosition(lineData.line.length, lineData.line);
        this.widthCache.setLineWidth(lineData.lineNumber, cachedWidth);
      }

      let xOffset = 0;

      for (let i = 0; i < lineData.line.length; i++) {
        const char = lineData.line[i];
        const glyph = this.textureAtlas.getGlyph(char, style);

        if (this.monospaceOpt.getIsMonospace()) {
          xOffset = i * this.charWidth;
        }

        const snappedX = Math.round(xOffset);
        const snappedY = Math.round(yOffset);

        const vertices = this.createGlyphVertices(
          snappedX,
          snappedY,
          glyph.width,
          glyph.height,
          glyph.x,
          glyph.y,
          2048
        );

        const vertexBuffer = this.createVertexBuffer(vertices);

        const uniformData = new Float32Array([
          ...projection,
          1.0, 1.0, 1.0, 1.0
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

        const bindGroup = this.device.createBindGroup({
          layout: this.pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
            { binding: 1, resource: this.textureAtlas.getTexture(glyph.page).createView() },
            { binding: 2, resource: this.sampler }
          ]
        });

        renderPass.setBindGroup(0, bindGroup);
        renderPass.setVertexBuffer(0, vertexBuffer);
        renderPass.draw(6, 1, 0, 0);

        if (!this.monospaceOpt.getIsMonospace()) {
          xOffset += glyph.width;
        }
      }
    }

    renderPass.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  private createGlyphVertices(
    x: number,
    y: number,
    width: number,
    height: number,
    texX: number,
    texY: number,
    atlasSize: number
  ): Float32Array {
    const u0 = texX / atlasSize;
    const v0 = texY / atlasSize;
    const u1 = (texX + width) / atlasSize;
    const v1 = (texY + height) / atlasSize;

    return new Float32Array([
      x, y, u0, v0,
      x + width, y, u1, v0,
      x, y + height, u0, v1,
      x, y + height, u0, v1,
      x + width, y, u1, v0,
      x + width, y + height, u1, v1,
    ]);
  }

  private createOrthographicProjection(width: number, height: number): number[] {
    return [
      2.0 / width, 0, 0, 0,
      0, -2.0 / height, 0, 0,
      0, 0, 1, 0,
      -1, 1, 0, 1
    ];
  }
}
