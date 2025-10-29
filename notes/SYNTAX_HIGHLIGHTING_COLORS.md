# Syntax Highlighting Color Implementation Plan

## Current State Analysis

### Existing Infrastructure
1. ✅ **Syntax Highlighting**: `SyntaxHighlighter` uses Prism.js to tokenize lines into token types
2. ✅ **Color Mapping**: `ColorMapper` maps token types to hex colors (e.g., 'keyword' → '#569CD6')
3. ✅ **Glyph Caching**: `TextureAtlas` caches glyphs with style (including color)
4. ❌ **Problem**: WebGPURenderer only uses a single white color (#FFFFFF) for all glyphs

### Current Rendering Flow
- `Editor` → gets tokens from `SyntaxHighlighter`
- `WebGPURenderer.render()` → creates ONE style with color '#FFFFFF'
- Each glyph is rasterized with this white color
- Shader samples the texture (already colored) and displays it

## The Issue

The current code at `WebGPURenderer.ts:253-259` creates a single GlyphStyle with white color for all characters:

```typescript
const style: GlyphStyle = {
  fontFamily: 'monospace',
  fontSize: 14,
  color: '#FFFFFF',  // ← ALWAYS WHITE
  bold: false,
  italic: false,
};
```

## Solution Architecture

### Key Insight
Glyphs are already rasterized WITH color baked into the texture. The shader in `glyph.wgsl:75` simply samples the texture:

```wgsl
return textureSample(glyphTexture, glyphSampler, input.texCoord, input.layerIndex);
```

### Two Possible Approaches

#### Approach A: Per-Character Style (Recommended)
Cache each character once per color in the texture atlas. When rendering:
- For each character + token color combo, get the cached colored glyph
- No shader changes needed - colors are baked into textures

**Pros:**
- Simple implementation
- No shader changes
- Leverages existing glyph caching system
- Colors are crisp (no interpolation issues)

**Cons:**
- More texture memory (same character in multiple colors)
- More cache entries

#### Approach B: Shader Color Modulation
Cache glyphs in white/grayscale and multiply by color in shader.
- Store colors in Cell storage buffer
- Shader multiplies sampled texture by color

**Pros:**
- Less texture memory
- Fewer cached glyphs

**Cons:**
- Requires shader modifications
- Color modulation may affect text quality
- Subpixel rendering complications

### Recommended Implementation: Approach A

**Why?** VS Code uses colored glyphs in the texture atlas for the same reason - it's simpler and produces better visual quality.

## Implementation Steps

### Step 1: Pass Tokens to Renderer
**File**: `Editor.ts:89`

Currently passes tokens but renderer ignores them. No changes needed.

### Step 2: Use ColorMapper in Renderer
**File**: `WebGPURenderer.ts`

- Import ColorMapper
- For each character, look up its token type
- Use ColorMapper to get the color
- Create GlyphStyle with that color
- Get/cache glyph from TextureAtlas

### Step 3: Update Render Loop Logic
**File**: `WebGPURenderer.ts:261-290`

Change from:
```typescript
for (const lineData of visibleLines) {
  for (let i = 0; i < lineData.line.length; ...) {
    const glyph = this.textureAtlas.getGlyph(char, style); // single style
  }
}
```

To:
```typescript
for (const lineData of visibleLines) {
  for (const token of lineData.tokens) {
    const color = colorMapper.getColor(token.type);
    const style: GlyphStyle = { ...baseStyle, color };
    for (let i = 0; i < token.content.length; ...) {
      const glyph = this.textureAtlas.getGlyph(char, style); // per-color style
    }
  }
}
```

### Step 4: Update Prewarm Atlas
**File**: `WebGPURenderer.ts:144-158`

Prewarm common characters in multiple colors (at least white, blue for keywords, green for comments).

### Step 5: Testing & Validation

- Verify different token types render in different colors
- Check glyph cache efficiency (monitor atlas pages)
- Test with large files
- Performance profiling

## Technical Considerations

1. **Glyph Cache Growth**: With ~10 colors and ~100 common characters, expect ~1000 cached glyphs (manageable)

2. **Atlas Space**: At 14px font, each glyph ~12x16 pixels. 1000 glyphs = ~192KB per atlas page (2048x2048 = 4MB capacity)

3. **Performance**: No shader changes means no performance impact. Glyph lookup is O(1) with Map.

4. **Bold/Italic**: Tokens might also need bold/italic (future enhancement)

## Code Changes Summary

**Files to modify:**
1. `WebGPURenderer.ts` - Main rendering logic (~30 lines changed)
   - Import ColorMapper
   - Change render loop to iterate tokens and use token colors
   - Update prewarm to cache multiple colors

**Files that DON'T need changes:**
- ✅ `glyph.wgsl` - Shader already samples colored textures
- ✅ `TextureAtlas.ts` - Already supports color in GlyphStyle
- ✅ `GlyphRasterizer.ts` - Already rasterizes with specified color
- ✅ `SyntaxHighlighter.ts` - Already tokenizes correctly
- ✅ `ColorMapper.ts` - Already has color mappings

## Expected Result

```
// Before:
function hello() {  ← all white

// After:
function hello() {
^^^^^^^^           ← blue (keyword)
         ^^^^^     ← yellow (function)
```

## Shader Color Sampling Location

**Line 75** in `glyph.wgsl` - Fragment shader:
```wgsl
return textureSample(glyphTexture, glyphSampler, input.texCoord, input.layerIndex);
```

The color is sampled from the texture and returned directly. Colors are pre-baked into the texture when glyphs are rasterized.
