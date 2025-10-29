# Selection Bug Fix - Mouse Drag Not Working

## Issue
Mouse drag selection was not working, even though keyboard selection (Shift+Arrow) worked correctly.

## Root Causes

### 1. Z-Index Stacking Problem
**Symptom**: Selection overlay was being rendered but not visible on screen.

**Cause**: The `<canvas>` element didn't have an explicit z-index, causing it to render on top of the selection overlay div (which had z-index: 1).

**Fix**: Added positioning and z-index to canvas in `index.html`:
```css
#editor-canvas {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
}
```

### 2. Selection Being Cleared During Mouse Drag
**Symptom**: Selection would start but immediately disappear when dragging.

**Cause**: In `InputHandler`, both `handleMouseDown` and `handleMouseMove` were calling `editor.setCursorPosition()`, which internally calls `selectionManager.clearSelection()`.

**Flow**:
```typescript
// handleMouseDown
editor.startSelection(line, col)        // ✓ Creates selection
editor.setCursorPosition(line, col)     // ✗ Clears it immediately!

// handleMouseMove (during drag)
editor.updateSelection(line, col)       // ✓ Updates selection
editor.setCursorPosition(line, col)     // ✗ Clears it immediately!
```

**Fix**: 
1. Added new method `setCursorPositionWithoutClearingSelection()` in `Editor.ts`
2. Updated `InputHandler` to use this method during mouse drag operations
3. Updated `Editor` interface in `InputHandler.ts` to include new method

### 3. Selection Being Cleared on Mouse Up (Click Event)
**Symptom**: Selection would be created during drag but disappear immediately after releasing the mouse button.

**Cause**: The browser event sequence is `mousedown` → `mousemove` → `mouseup` → **`click`**. The `click` event was firing after `mouseup` and calling `setCursorPosition()`, which cleared the selection.

**Flow**:
```typescript
mousedown  → startSelection()           // ✓ Creates selection
mousemove  → updateSelection()          // ✓ Updates selection  
mouseup    → (just resets isMouseDown) // ✓ OK
click      → setCursorPosition()        // ✗ Clears selection!
```

**Fix**:
1. Don't reset `isDragging` flag in `handleMouseUp` 
2. Check `isDragging` in `handleClick` and skip processing if we were dragging
3. Reset `isDragging` in `handleClick` after preventing the click action

## Files Modified

1. **index.html**
   - Added z-index: 0 to canvas

2. **src/core/Editor.ts**
   - Added `setCursorPositionWithoutClearingSelection()` method

3. **src/input/InputHandler.ts**
   - Updated interface to include new method
   - Changed `handleMouseDown` to use new method
   - Changed `handleMouseMove` to use new method

4. **src/rendering/SelectionRenderer.ts**
   - Added `overflow: hidden` to overlay div for better boundary handling

5. **notes/SELECTION_IMPLEMENTATION.md**
   - Updated documentation with new method

## Testing Results

- ✅ Keyboard selection (Shift+Arrow) works
- ✅ Mouse drag selection works
- ✅ Shift+Click to extend selection works
- ✅ Selection is visible with correct z-index ordering
- ✅ Cursor remains visible above selection

## Lessons Learned

1. **Z-Index Management**: When mixing WebGPU canvas rendering with DOM overlays, explicit z-index values are essential.

2. **State Clearing Side Effects**: Methods that clear state (like `setCursorPosition`) should be separated from methods that only move the cursor, to allow fine-grained control during complex operations like selection.

3. **Browser Event Ordering**: Be aware of the event sequence: `mousedown` → `mousemove` → `mouseup` → `click`. The `click` event fires AFTER `mouseup`, which can interfere with drag operations if not handled carefully.

4. **State Flag Management**: When handling mouse drag operations, carefully manage when to set and reset state flags like `isDragging` to prevent unwanted side effects from subsequent event handlers.

5. **Debugging Strategy**: When a feature works with one input method (keyboard) but not another (mouse), the issue is likely in the input handling logic rather than the rendering or state management.
