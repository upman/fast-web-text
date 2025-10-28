// Structures
struct LayoutInfo {
  canvasDims: vec2<f32>,
  viewportOffset: vec2<f32>,
  viewportDims: vec2<f32>,
}

struct GlyphInfo {
  position: vec2<f32>,    // Position in atlas texture
  size: vec2<f32>,        // Size in atlas texture
  origin: vec2<f32>,      // Origin offset for rendering
}

struct Cell {
  position: vec2<f32>,    // Screen position (x, y)
  unused: vec2<f32>,      // Padding for alignment
  glyphIndex: f32,        // Index into glyphInfo array
  textureLayer: f32,      // Which atlas page (texture array layer)
}

struct VertexInput {
  @location(0) position: vec2<f32>,  // Shared quad vertex (0-1 range)
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) texCoord: vec2<f32>,
  @location(1) @interpolate(flat) layerIndex: u32,
}

// Bindings
@group(0) @binding(0) var<uniform> layoutInfo: LayoutInfo;
@group(0) @binding(1) var<uniform> atlasDims: vec2<f32>;
@group(0) @binding(2) var<storage, read> glyphInfo: array<GlyphInfo>;
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
  let glyphIdx = u32(cell.glyphIndex);
  let glyph = glyphInfo[glyphIdx];

  // Calculate screen position
  // vertex.position is 0-1 quad, scale by glyph size
  let screenPos = cell.position + (vertex.position * glyph.size) + glyph.origin;

  // Convert to clip space (-1 to 1)
  let clipPos = vec2<f32>(
    (screenPos.x / layoutInfo.canvasDims.x) * 2.0 - 1.0,
    1.0 - (screenPos.y / layoutInfo.canvasDims.y) * 2.0
  );

  // Calculate texture coordinates
  let texCoord = (glyph.position + vertex.position * glyph.size) / atlasDims;

  var output: VertexOutput;
  output.position = vec4<f32>(clipPos, 0.0, 1.0);
  output.texCoord = texCoord;
  output.layerIndex = u32(cell.textureLayer);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  // Sample from texture array using layer index
  return textureSample(glyphTexture, glyphSampler, input.texCoord, input.layerIndex);
}
