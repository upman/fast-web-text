# Fast-Web-Text: WebGPU-Accelerated Text Editor

> A portfolio project demonstrating high-performance text rendering using WebGPU, inspired by VS Code's architecture.
> Target: Smooth rendering of 10,000+ line files at 60 FPS.
> Simple code that is easy to read and learn from. No big architecture patterns etc. with many layers of indirection.
> All the file paths mentioned in the plan are in ../vscode/
## Project Overview

### Core Features
- ✅ WebGPU-based text rendering with glyph caching
- ✅ Viewport virtualization (only render visible lines)
- ✅ Syntax highlighting (using Prism.js or Shiki)
- ✅ All 4 performance optimizations from VS Code
- ✅ Accessibility support (screen reader compatible)
- ✅ TypeScript implementation
- ✅ No framework dependencies

### Performance Goals
- **10,000 line files**: Render at 60 FPS
- **Scroll latency**: < 16ms per frame
- **Keystroke latency**: < 10ms
- **Memory usage**: < 100MB for 10k lines
- **Startup time**: < 500ms

---

## Architecture Overview

```
fast-web-text/
├── src/
│   ├── core/
│   │   ├── Editor.ts              # Main editor controller
│   │   ├── Document.ts            # Document model (lines, content)
│   │   └── ViewportManager.ts     # Visible line calculation
│   │
│   ├── rendering/
│   │   ├── WebGPURenderer.ts      # Main WebGPU rendering pipeline
│   │   ├── TextureAtlas.ts        # Glyph cache management
│   │   ├── GlyphRasterizer.ts     # Canvas 2D glyph rasterization
│   │   └── ShaderManager.ts       # WGSL shader compilation
│   │
│   ├── optimizations/
│   │   ├── MonospaceOptimizer.ts  # Fast path for monospace fonts
│   │   ├── LineWidthCache.ts      # Cache line measurements
│   │   └── LayerHinting.ts        # CSS transform optimization
│   │
│   ├── accessibility/
│   │   ├── ScreenReaderSupport.ts # Hidden textarea management
│   │   └── AriaManager.ts         # ARIA attributes
│   │
│   ├── syntax/
│   │   ├── SyntaxHighlighter.ts   # Wrapper for Prism/Shiki
│   │   └── TokenCache.ts          # Cache tokenization results
│   │
│   ├── input/
│   │   ├── InputHandler.ts        # Keyboard/mouse events
│   │   └── SelectionManager.ts    # Text selection state
│   │
│   ├── shaders/
│   │   ├── glyph.wgsl             # Glyph rendering shader
│   │   └── cursor.wgsl            # Cursor rendering shader
│   │
│   └── utils/
│       ├── FontMetrics.ts         # Measure font dimensions
│       ├── ColorUtils.ts          # Color parsing/conversion
│       └── MathUtils.ts           # Vector/matrix helpers
│
├── public/
│   ├── index.html
│   └── styles.css
│
├── tests/
│   ├── rendering.test.ts
│   └── performance.test.ts
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Phase 1: Core Setup (Week 1)

### 1.1 Project Initialization
```bash
npm init -y
npm install -D typescript vite @types/node
npm install prismjs @types/prismjs
```

### 1.2 Basic Document Model
**File**: `src/core/Document.ts`

**VS Code Reference**:
- `/src/vs/editor/common/model/textModel.ts` (lines 1-500)

**Implementation**:
```typescript
class Document {
  private lines: string[];
  private lineCache: Map<number, LineData>;

  constructor(content: string) {
    this.lines = content.split('\n');
  }

  getLine(lineNumber: number): string
  getLineCount(): number
  insertText(line: number, col: number, text: string): void
  deleteText(range: Range): void
}

interface LineData {
  content: string;
  tokens: Token[];
  width?: number; // Cached width
}
```

### 1.3 Viewport Manager
**File**: `src/core/ViewportManager.ts`

**VS Code Reference**:
- `/src/vs/editor/common/viewLayout/viewLayout.ts` (lines 150-350)
- `/src/vs/editor/common/viewLayout/viewLinesViewportData.ts`

**Implementation**:
```typescript
class ViewportManager {
  private lineHeight: number = 18;
  private canvasHeight: number;

  getVisibleLineRange(scrollTop: number): {
    startLine: number;
    endLine: number;
  }

  // Only render visible lines + buffer
  getVisibleLinesWithBuffer(scrollTop: number): number[] {
    const visible = this.getVisibleLineRange(scrollTop);
    const buffer = 10; // Render 10 extra lines above/below
    return range(visible.startLine - buffer, visible.endLine + buffer);
  }
}
```

---

## Phase 2: WebGPU Rendering Pipeline (Week 2)

### 2.1 WebGPU Context Setup
**File**: `src/rendering/WebGPURenderer.ts`

**VS Code Reference**:
- `/src/vs/editor/browser/gpu/viewGpuContext.ts` (lines 1-150)
- `/src/vs/editor/browser/viewParts/viewLinesGpu/viewLinesGpu.ts` (lines 1-200)

**Implementation**:
```typescript
class WebGPURenderer {
  private device: GPUDevice;
  private context: GPUCanvasContext;
  private pipeline: GPURenderPipeline;
  private textureAtlas: TextureAtlas;

  async initialize(): Promise<void> {
    // 1. Request GPU adapter
    const adapter = await navigator.gpu?.requestAdapter();
    this.device = await adapter.requestDevice();

    // 2. Configure canvas context
    const canvas = document.getElementById('editor-canvas') as HTMLCanvasElement;
    this.context = canvas.getContext('webgpu')!;
    this.context.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
      alphaMode: 'premultiplied',
    });

    // 3. Create texture atlas
    this.textureAtlas = new TextureAtlas(this.device, 2048);

    // 4. Compile shaders and create pipeline
    await this.createRenderPipeline();
  }

  render(visibleLines: LineData[], scrollTop: number): void
}
```

### 2.2 Shader Implementation
**File**: `src/shaders/glyph.wgsl`

**VS Code Reference**:
- `/src/vs/editor/browser/gpu/rectangleRenderer.ts` (lines 100-300)

**Implementation**:
```wgsl
// Vertex shader
struct VertexInput {
  @location(0) position: vec2<f32>,
  @location(1) texCoord: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
  @location(1) color: vec4<f32>,
}

@group(0) @binding(0) var<uniform> viewProjection: mat4x4<f32>;
@group(0) @binding(1) var glyphTexture: texture_2d<f32>;
@group(0) @binding(2) var glyphSampler: sampler;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = viewProjection * vec4<f32>(input.position, 0.0, 1.0);
  output.texCoord = input.texCoord;
  return output;
}

// Fragment shader
@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let texColor = textureSample(glyphTexture, glyphSampler, input.texCoord);
  return texColor * input.color;
}
```

---

## Phase 3: Glyph Caching System (Week 3)

### 3.1 Texture Atlas
**File**: `src/rendering/TextureAtlas.ts`

**VS Code Reference**:
- `/src/vs/editor/browser/gpu/atlas/textureAtlas.ts` (complete file)
- `/src/vs/editor/browser/gpu/atlas/textureAtlasPage.ts` (lines 1-150)

**Implementation**:
```typescript
class TextureAtlas {
  private pages: TextureAtlasPage[] = [];
  private glyphCache: Map<string, CachedGlyph> = new Map();
  private device: GPUDevice;
  private pageSize: number;

  constructor(device: GPUDevice, pageSize: number = 2048) {
    this.device = device;
    this.pageSize = pageSize;
    this.createNewPage();
  }

  getGlyph(char: string, style: GlyphStyle): CachedGlyph {
    const key = this.makeKey(char, style);

    if (this.glyphCache.has(key)) {
      return this.glyphCache.get(key)!;
    }

    // Rasterize and cache
    const glyph = this.rasterizer.rasterize(char, style);
    return this.allocateGlyph(glyph);
  }

  private makeKey(char: string, style: GlyphStyle): string {
    return `${char}_${style.fontFamily}_${style.fontSize}_${style.color}_${style.bold}_${style.italic}`;
  }
}

interface CachedGlyph {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}
```

### 3.2 Glyph Rasterizer
**File**: `src/rendering/GlyphRasterizer.ts`

**VS Code Reference**:
- `/src/vs/editor/browser/gpu/raster/glyphRasterizer.ts` (complete file)

**Implementation**:
```typescript
class GlyphRasterizer {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;

  constructor() {
    this.canvas = new OffscreenCanvas(128, 128);
    this.ctx = this.canvas.getContext('2d')!;
  }

  rasterize(char: string, style: GlyphStyle): ImageData {
    // Clear canvas
    this.ctx.clearRect(0, 0, 128, 128);

    // Set font style
    const fontStr = `${style.bold ? 'bold ' : ''}${style.italic ? 'italic ' : ''}${style.fontSize}px ${style.fontFamily}`;
    this.ctx.font = fontStr;
    this.ctx.fillStyle = style.color;
    this.ctx.textBaseline = 'top';

    // Draw character
    this.ctx.fillText(char, 0, 0);

    // Get image data
    const metrics = this.ctx.measureText(char);
    const width = Math.ceil(metrics.width);
    const height = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);

    return this.ctx.getImageData(0, 0, width, height);
  }
}
```

---

## Phase 4: Performance Optimizations (Week 4)

### 4.1 Monospace Optimizer
**File**: `src/optimizations/MonospaceOptimizer.ts`

**VS Code Reference**:
- `/src/vs/editor/common/viewLayout/viewLineRenderer.ts` (lines 750-850)
- `/src/vs/editor/common/config/editorOptions.ts` (search for "disableMonospaceOptimizations")

**Implementation**:
```typescript
class MonospaceOptimizer {
  private isMonospace: boolean = false;
  private charWidth: number = 0;

  detectMonospace(fontFamily: string, fontSize: number): boolean {
    // Measure various characters
    const testChars = 'iMW0123';
    const widths = testChars.split('').map(c => this.measureChar(c));

    // If all same width → monospace
    const allEqual = widths.every(w => Math.abs(w - widths[0]) < 0.1);

    if (allEqual) {
      this.isMonospace = true;
      this.charWidth = widths[0];
    }

    return this.isMonospace;
  }

  getCharPosition(column: number): number {
    if (this.isMonospace) {
      // Fast path: O(1) calculation
      return column * this.charWidth;
    } else {
      // Slow path: must measure
      return this.measureWidth(text.substring(0, column));
    }
  }
}
```

### 4.2 Line Width Cache
**File**: `src/optimizations/LineWidthCache.ts`

**VS Code Reference**:
- `/src/vs/editor/browser/viewParts/viewLines/viewLines.ts` (lines 520-650)

**Implementation**:
```typescript
class LineWidthCache {
  private cache: Map<number, number> = new Map();
  private maxWidth: number = 0;

  getLineWidth(lineNumber: number): number | undefined {
    return this.cache.get(lineNumber);
  }

  setLineWidth(lineNumber: number, width: number): void {
    this.cache.set(lineNumber, width);
    this.maxWidth = Math.max(this.maxWidth, width);
  }

  invalidateLine(lineNumber: number): void {
    this.cache.delete(lineNumber);
    // Recalculate maxWidth if needed
    if (this.cache.size > 0) {
      this.maxWidth = Math.max(...this.cache.values());
    }
  }

  getMaxWidth(): number {
    return this.maxWidth;
  }
}
```

### 4.3 Layer Hinting
**File**: `src/optimizations/LayerHinting.ts`

**VS Code Reference**:
- `/src/vs/base/browser/fastDomNode.ts` (lines 200-250)
- `/src/vs/editor/browser/viewParts/viewLines/viewLines.ts` (search for "setLayerHinting")

**Implementation**:
```typescript
class LayerHinting {
  applyHint(element: HTMLElement): void {
    // Force browser to create GPU-composited layer
    element.style.transform = 'translate3d(0px, 0px, 0px)';
    element.style.willChange = 'transform';
  }

  removeHint(element: HTMLElement): void {
    element.style.transform = '';
    element.style.willChange = '';
  }
}
```

---

## Phase 5: Syntax Highlighting (Week 5)

### 5.1 Syntax Highlighter
**File**: `src/syntax/SyntaxHighlighter.ts`

**External Package**: Prism.js
```bash
npm install prismjs @types/prismjs
```

**Implementation**:
```typescript
import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';

class SyntaxHighlighter {
  private tokenCache: Map<number, Token[]> = new Map();

  tokenize(line: string, language: string): Token[] {
    const grammar = Prism.languages[language];
    if (!grammar) return [{ type: 'plain', content: line }];

    const tokens = Prism.tokenize(line, grammar);
    return this.flattenTokens(tokens);
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
}

interface Token {
  type: string;        // 'keyword', 'string', 'comment', etc.
  content: string;     // The actual text
  startColumn: number;
  endColumn: number;
}
```

### 5.2 Color Mapping
**File**: `src/utils/ColorUtils.ts`

**VS Code Reference**:
- `/src/vs/editor/browser/gpu/css/decorationCssRuleExtractor.ts`

**Implementation**:
```typescript
class ColorMapper {
  private colorMap: Map<string, string> = new Map([
    ['keyword', '#569CD6'],    // Blue
    ['string', '#CE9178'],     // Orange
    ['comment', '#6A9955'],    // Green
    ['function', '#DCDCAA'],   // Yellow
    ['number', '#B5CEA8'],     // Light green
    ['operator', '#D4D4D4'],   // Gray
  ]);

  getColor(tokenType: string): string {
    return this.colorMap.get(tokenType) || '#D4D4D4';
  }
}
```

---

## Phase 6: Accessibility Support (Week 6)

### 6.1 Screen Reader Support
**File**: `src/accessibility/ScreenReaderSupport.ts`

**VS Code Reference**:
- `/src/vs/editor/browser/controller/editContext/textArea/textAreaEditContext.ts` (lines 1-200)
- `/src/vs/editor/browser/controller/editContext/native/screenReaderSupport.ts` (complete)

**Implementation**:
```typescript
class ScreenReaderSupport {
  private textarea: HTMLTextAreaElement;
  private currentLine: number = 0;
  private pageSize: number = 50; // Lines per page

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

    // Position off-screen but keep accessible
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    textarea.style.width = '1px';
    textarea.style.height = '1px';

    return textarea;
  }

  updateContent(document: Document, cursorLine: number): void {
    // Page-based content for screen readers
    const startLine = Math.floor(cursorLine / this.pageSize) * this.pageSize;
    const endLine = Math.min(startLine + this.pageSize, document.getLineCount());

    const content = [];
    for (let i = startLine; i < endLine; i++) {
      content.push(document.getLine(i));
    }

    this.textarea.value = content.join('\n');

    // Set cursor position within textarea
    const offsetInPage = cursorLine - startLine;
    const charOffset = content.slice(0, offsetInPage).join('\n').length;
    this.textarea.setSelectionRange(charOffset, charOffset);
  }
}
```

### 6.2 ARIA Manager
**File**: `src/accessibility/AriaManager.ts`

**Implementation**:
```typescript
class AriaManager {
  updateAttributes(canvas: HTMLCanvasElement, state: EditorState): void {
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `Code editor, line ${state.cursorLine} of ${state.lineCount}`);
  }

  announceChange(message: string): void {
    // Use aria-live region for announcements
    const liveRegion = document.getElementById('editor-live-region');
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  }
}
```

---

## Phase 7: Input Handling (Week 7)

### 7.1 Input Handler
**File**: `src/input/InputHandler.ts`

**VS Code Reference**:
- `/src/vs/editor/browser/controller/textAreaInput.ts`
- `/src/vs/editor/browser/controller/pointerHandler.ts`

**Implementation**:
```typescript
class InputHandler {
  private editor: Editor;
  private textarea: HTMLTextAreaElement;

  constructor(editor: Editor, textarea: HTMLTextAreaElement) {
    this.editor = editor;
    this.textarea = textarea;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Keyboard input
    this.textarea.addEventListener('input', (e) => {
      this.handleInput(e);
    });

    this.textarea.addEventListener('keydown', (e) => {
      this.handleKeydown(e);
    });

    // Mouse input on canvas
    const canvas = this.editor.getCanvas();
    canvas.addEventListener('click', (e) => {
      this.handleClick(e);
    });

    canvas.addEventListener('wheel', (e) => {
      this.handleScroll(e);
    });
  }

  private handleInput(e: Event): void {
    const newText = this.textarea.value;
    // Insert text at cursor position
    this.editor.insertText(newText);
  }

  private handleKeydown(e: KeyboardEvent): void {
    // Handle special keys
    if (e.key === 'ArrowUp') {
      this.editor.moveCursor(-1, 0);
      e.preventDefault();
    }
    // ... more key handlers
  }
}
```

---

## Phase 8: Main Editor Controller (Week 8)

### 8.1 Editor Class
**File**: `src/core/Editor.ts`

**VS Code Reference**:
- `/src/vs/editor/browser/view.ts` (lines 1-300)
- `/src/vs/editor/browser/codeEditor.ts`

**Implementation**:
```typescript
class Editor {
  private document: Document;
  private renderer: WebGPURenderer;
  private viewport: ViewportManager;
  private highlighter: SyntaxHighlighter;
  private screenReader: ScreenReaderSupport;
  private inputHandler: InputHandler;

  // Optimizations
  private monospaceOpt: MonospaceOptimizer;
  private widthCache: LineWidthCache;
  private layerHinting: LayerHinting;

  // State
  private scrollTop: number = 0;
  private cursorLine: number = 0;
  private cursorColumn: number = 0;

  async initialize(container: HTMLElement, content: string): Promise<void> {
    // 1. Create document
    this.document = new Document(content);

    // 2. Setup WebGPU renderer
    this.renderer = new WebGPURenderer();
    await this.renderer.initialize();

    // 3. Setup viewport
    this.viewport = new ViewportManager(container.clientHeight);

    // 4. Setup syntax highlighting
    this.highlighter = new SyntaxHighlighter();

    // 5. Setup accessibility
    this.screenReader = new ScreenReaderSupport(container);

    // 6. Setup optimizations
    this.monospaceOpt = new MonospaceOptimizer();
    this.widthCache = new LineWidthCache();
    this.layerHinting = new LayerHinting();

    // 7. Setup input
    this.inputHandler = new InputHandler(this, this.screenReader.textarea);

    // 8. Start render loop
    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    const render = () => {
      // Get visible lines
      const visibleRange = this.viewport.getVisibleLineRange(this.scrollTop);

      // Get line data with tokens
      const visibleLines = [];
      for (let i = visibleRange.startLine; i <= visibleRange.endLine; i++) {
        const line = this.document.getLine(i);
        const tokens = this.highlighter.getCachedTokens(i, line, 'typescript');
        visibleLines.push({ line, tokens, lineNumber: i });
      }

      // Render with WebGPU
      this.renderer.render(visibleLines, this.scrollTop);

      // Update accessibility
      this.screenReader.updateContent(this.document, this.cursorLine);

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  // Public API
  insertText(text: string): void {
    this.document.insertText(this.cursorLine, this.cursorColumn, text);
    this.widthCache.invalidateLine(this.cursorLine);
    this.highlighter.invalidateCache(this.cursorLine, this.cursorLine);
  }

  scroll(deltaY: number): void {
    this.scrollTop = Math.max(0, this.scrollTop + deltaY);
  }

  moveCursor(deltaLine: number, deltaCol: number): void {
    this.cursorLine = Math.max(0, Math.min(this.document.getLineCount() - 1, this.cursorLine + deltaLine));
    this.cursorColumn = Math.max(0, this.cursorColumn + deltaCol);
  }
}
```

---

## Performance Benchmarks

### Target Metrics
```typescript
// File: tests/performance.test.ts

describe('Performance', () => {
  test('Render 10,000 lines', () => {
    const lines = generateLines(10000);
    const editor = new Editor();

    const start = performance.now();
    editor.initialize(container, lines);
    const initTime = performance.now() - start;

    expect(initTime).toBeLessThan(500); // < 500ms initialization
  });

  test('Scroll performance', () => {
    const editor = new Editor();
    editor.initialize(container, generateLines(10000));

    const scrollTimes = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      editor.scroll(100);
      scrollTimes.push(performance.now() - start);
    }

    const avgScrollTime = scrollTimes.reduce((a, b) => a + b) / scrollTimes.length;
    expect(avgScrollTime).toBeLessThan(16); // < 16ms per frame (60 FPS)
  });

  test('Memory usage', () => {
    const editor = new Editor();
    editor.initialize(container, generateLines(10000));

    const memoryUsed = (performance as any).memory.usedJSHeapSize;
    expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // < 100MB
  });
});
```

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Project setup (TypeScript, Vite)
- [ ] Document model
- [ ] Viewport manager
- [ ] Basic HTML structure

### Week 2: WebGPU Basics
- [ ] WebGPU context initialization
- [ ] Basic shader implementation
- [ ] Simple rectangle rendering
- [ ] Camera/projection setup

### Week 3: Glyph System
- [ ] Texture atlas implementation
- [ ] Glyph rasterizer
- [ ] Cache management
- [ ] Atlas allocation strategies

### Week 4: Optimizations
- [ ] Monospace detection
- [ ] Line width caching
- [ ] Layer hinting
- [ ] Fast path implementations

### Week 5: Syntax Highlighting
- [ ] Prism.js integration
- [ ] Token caching
- [ ] Color mapping
- [ ] Multi-language support

### Week 6: Accessibility
- [ ] Hidden textarea
- [ ] Screen reader support
- [ ] ARIA attributes
- [ ] Keyboard navigation

### Week 7: Input Handling
- [ ] Keyboard events
- [ ] Mouse events
- [ ] Selection management
- [ ] Cursor rendering

### Week 8: Polish & Demo
- [ ] Performance testing
- [ ] Bug fixes
- [ ] Demo UI/UX
- [ ] Documentation
- [ ] Portfolio deployment

---

## Demo Features

### Interactive Demo Page
```html
<!-- public/index.html -->
<!DOCTYPE html>
<html>
<head>
  <title>Fast-Web-Text Demo</title>
  <style>
    #editor-container {
      width: 100vw;
      height: 100vh;
      position: relative;
    }

    #editor-canvas {
      width: 100%;
      height: 100%;
    }

    #stats {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div id="editor-container">
    <canvas id="editor-canvas"></canvas>
    <div id="stats">
      <div>FPS: <span id="fps">60</span></div>
      <div>Lines: <span id="line-count">10000</span></div>
      <div>Memory: <span id="memory">0</span> MB</div>
      <div>Cached Glyphs: <span id="glyph-count">0</span></div>
    </div>
  </div>

  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### Performance Dashboard
- Real-time FPS counter
- Memory usage graph
- Glyph cache statistics
- Render time breakdown
- Toggle optimizations on/off to show impact

---

## VS Code Reference Files (Quick Lookup)

### Core Architecture
- **Main View**: `/src/vs/editor/browser/view.ts`
- **View Lines**: `/src/vs/editor/browser/viewParts/viewLines/viewLines.ts`
- **View Line**: `/src/vs/editor/browser/viewParts/viewLines/viewLine.ts`

### WebGPU Rendering
- **GPU Context**: `/src/vs/editor/browser/gpu/viewGpuContext.ts`
- **GPU View Lines**: `/src/vs/editor/browser/viewParts/viewLinesGpu/viewLinesGpu.ts`
- **Rectangle Renderer**: `/src/vs/editor/browser/gpu/rectangleRenderer.ts`

### Texture Atlas
- **Atlas**: `/src/vs/editor/browser/gpu/atlas/textureAtlas.ts`
- **Atlas Page**: `/src/vs/editor/browser/gpu/atlas/textureAtlasPage.ts`
- **Glyph Rasterizer**: `/src/vs/editor/browser/gpu/raster/glyphRasterizer.ts`

### Optimizations
- **Line Renderer**: `/src/vs/editor/common/viewLayout/viewLineRenderer.ts`
- **Fast DOM**: `/src/vs/base/browser/fastDomNode.ts`
- **View Layout**: `/src/vs/editor/common/viewLayout/viewLayout.ts`

### Accessibility
- **Textarea Context**: `/src/vs/editor/browser/controller/editContext/textArea/textAreaEditContext.ts`
- **Screen Reader Support**: `/src/vs/editor/browser/controller/editContext/native/screenReaderSupport.ts`
- **Screen Reader Utils**: `/src/vs/editor/browser/controller/editContext/screenReaderUtils.ts`

### Configuration
- **Editor Options**: `/src/vs/editor/common/config/editorOptions.ts`
- **Font Info**: `/src/vs/editor/common/config/fontInfo.ts`

---

## Portfolio Highlights

### What This Demonstrates
1. **Advanced WebGPU**: Real-world GPU programming with WGSL shaders
2. **Performance Engineering**: Sub-16ms frame times with complex rendering
3. **Browser APIs**: Canvas 2D, WebGPU, Web Workers
4. **Accessibility**: WCAG compliant with screen reader support
5. **TypeScript Mastery**: Complex type system, generics, advanced patterns
6. **Architecture**: Scalable, modular design inspired by VS Code

### Demo Talking Points
- "Renders 10,000 lines at 60 FPS using WebGPU"
- "Glyph caching reduces render time by 200×"
- "Viewport virtualization: only renders visible content"
- "Full accessibility support with hidden textarea layer"
- "Monospace optimizations enable O(1) position calculations"

---

## Next Steps

1. **Start with Week 1**: Get the foundation working
2. **Iterate quickly**: Don't perfect each phase before moving on
3. **Profile early**: Use Chrome DevTools Performance tab
4. **Test on real files**: Use actual large TypeScript/JavaScript files
5. **Document learnings**: Write blog post about the journey

Good luck with your portfolio project! 🚀
