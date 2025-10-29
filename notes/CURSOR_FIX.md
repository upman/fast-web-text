# Cursor Position Fix

## Problem
The cursor was appearing 2 lines below where text edits were happening.

## Root Cause
**Coordinate System Mismatch**: The WebGPU renderer and DOM cursor were using different coordinate systems.

- **WebGPU Renderer**: Was using `canvas.width` / `canvas.height` (buffer pixels scaled by devicePixelRatio)
  - Example: On a 2x DPR display, a 1000px wide canvas has `canvas.width = 2000` (buffer pixels)
  
- **DOM Cursor**: Was using CSS pixels for positioning
  - Example: Same canvas has `clientWidth = 1000` (CSS pixels)

## Solution
Changed the WebGPU renderer to use CSS pixel dimensions instead of buffer pixel dimensions:

```typescript
// Before (WRONG):
const layoutInfo = new Float32Array([
  this.canvas.width,   // buffer pixels (e.g., 2000)
  this.canvas.height,  // buffer pixels
  ...
]);

// After (CORRECT):
const layoutInfo = new Float32Array([
  this.canvas.clientWidth,   // CSS pixels (e.g., 1000)
  this.canvas.clientHeight,  // CSS pixels
  ...
]);
```

## Key Changes Made

1. **WebGPURenderer.ts**: Changed `render()` method to use `clientWidth`/`clientHeight`
2. **WebGPURenderer.ts**: Added `getLineHeight()` and `getCharWidth()` methods
3. **Editor.ts**: Updated cursor dimensions after renderer initialization
4. **CursorRenderer.ts**: Already correctly using CSS pixels

## Result
Both the WebGPU text rendering and DOM cursor now use the same coordinate system (CSS pixels), ensuring they stay perfectly aligned regardless of the device's pixel ratio.

## Testing
- Test on different devicePixelRatio displays (1x, 2x, 3x)
- Verify cursor follows text edits exactly
- Check that arrow key navigation moves cursor correctly
