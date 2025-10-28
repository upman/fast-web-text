# Quick Start Testing Guide

## Running the Updated Editor

1. **Start the dev server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Open in browser:**
   - Navigate to `http://localhost:5173` (or whatever port Vite uses)
   - **IMPORTANT:** Use Chrome, Edge, or another Chromium-based browser (WebGPU required)

3. **Check browser console:**
   - Press F12 to open DevTools
   - Look for any WebGPU errors or shader compilation errors
   - Should see successful initialization messages

---

## What to Look For

### ✅ Success Indicators:
- Text renders on screen
- Smooth scrolling (should feel instant)
- 60 FPS in performance monitor
- Console shows no errors

### ⚠️ Potential Issues:

#### Nothing renders:
```javascript
// Check console for:
"WebGPU not supported"          → Need Chrome 113+ or enable flags
"Failed to load shader"         → Check shader file path
"Pipeline creation failed"      → WGSL syntax error
```

#### Text in wrong position:
- Check canvas dimensions in layoutInfo
- Verify device pixel ratio handling
- Check coordinate system (origin top-left vs center)

#### Some characters missing:
- Increase MAX_VISIBLE_GLYPHS constant
- Check glyphInfo buffer size
- Verify prewarmAtlas() ran

---

## Performance Testing

### Measure FPS:

**Option 1: Browser DevTools**
```javascript
// In console, run:
let lastTime = performance.now();
let frames = 0;
function measureFPS() {
  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    console.log(`FPS: ${frames}`);
    frames = 0;
    lastTime = now;
  }
  requestAnimationFrame(measureFPS);
}
measureFPS();
```

**Option 2: Add FPS counter to UI**
```typescript
// In Editor.ts or main.ts
let frameCount = 0;
let lastTime = performance.now();

function updateFPS() {
  frameCount++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    const fps = frameCount;
    console.log(`FPS: ${fps}`);
    // Or update DOM element
    document.getElementById('fps')!.textContent = fps.toString();
    frameCount = 0;
    lastTime = now;
  }
}

// Call in render loop
```

### Compare Performance:

**Old Implementation:**
- Expected: ~5-10 FPS with 1000+ lines
- Draw calls: ~4000 per frame

**New Implementation:**
- Expected: 60 FPS (capped by refresh rate)
- Draw calls: 1 per frame

### Measure Draw Calls:

**Chrome DevTools → Performance Tab:**
1. Start recording
2. Scroll or interact with editor
3. Stop recording
4. Look at "GPU" timeline
5. Should see ONE draw call per frame (not hundreds)

---

## Troubleshooting

### Issue: Black screen, no text

**Debug steps:**
1. Check console for errors
2. Verify shader loads:
   ```javascript
   fetch('/src/shaders/glyph.wgsl')
     .then(r => r.text())
     .then(console.log);
   ```
3. Check glyphCount in render():
   ```typescript
   console.log('Rendering glyphCount:', glyphCount);
   ```
4. Verify bind group bindings match shader

### Issue: Characters in wrong positions

**Debug steps:**
1. Log cell data:
   ```typescript
   console.log('Cell 0:', cellData.slice(0, 6));
   ```
2. Check layoutInfo values:
   ```typescript
   console.log('Canvas:', this.canvas.width, this.canvas.height);
   ```
3. Verify coordinate system in shader

### Issue: Performance still slow

**Debug steps:**
1. Open DevTools → Performance
2. Record while scrolling
3. Check for:
   - Multiple draw calls per frame
   - Buffer allocations in render()
   - Bind group creations in render()
4. Verify you're using the NEW WebGPURenderer code

### Issue: Some characters not rendering

**Debug steps:**
1. Check MAX_VISIBLE_GLYPHS (increase if needed)
2. Verify character in prewarmAtlas():
   ```typescript
   const chars = '... add your missing character ...';
   ```
3. Check glyphIndex range:
   ```typescript
   console.log('Max glyph index:', this.textureAtlas.nextGlyphIndex);
   ```

---

## Expected Results

### Small file (100 lines):
- FPS: 60 (capped)
- Draw calls: 1
- Frame time: <1ms

### Medium file (1,000 lines):
- FPS: 60 (capped)
- Draw calls: 1
- Frame time: ~2ms

### Large file (10,000 lines):
- FPS: 60 (capped)
- Draw calls: 1
- Frame time: ~3-5ms

### Scrolling:
- Smooth, no lag
- Instant response
- No frame drops

---

## Next Steps After Testing

1. **If working well:**
   - Add syntax highlighting colors
   - Implement cursor rendering
   - Add dirty line tracking
   - Optimize atlas management

2. **If issues found:**
   - Check IMPLEMENTATION_SUMMARY.md debugging section
   - Review PERFORMANCE_ISSUES.md for architecture understanding
   - Compare with VS Code implementation in ../vscode/

3. **Future optimizations:**
   - Dirty tracking (only update changed lines)
   - Double buffering (prevent stalls)
   - Background glyph rasterization
   - LRU cache for glyphs

---

## Success Metrics

✅ Text renders correctly
✅ 60 FPS with large files
✅ One draw call per frame
✅ Smooth scrolling
✅ <5ms frame time for 10k lines

If all metrics pass, you've successfully implemented VS Code-level performance! 🚀
