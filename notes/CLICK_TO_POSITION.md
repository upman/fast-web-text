# Click-to-Position Cursor Feature

## Overview
Implemented the ability to click anywhere in the editor to position the cursor at that location.

## Implementation

### 1. InputHandler Interface Extension
Added new methods to the `Editor` interface that the InputHandler needs:

```typescript
export interface Editor {
  // ... existing methods
  setCursorPosition(line: number, column: number): void;
  getScrollTop(): number;
  getLineHeight(): number;
  getCharWidth(): number;
}
```

### 2. Click Handler Logic
The `handleClick` method now:

1. **Gets click coordinates** relative to the canvas using `getBoundingClientRect()`
2. **Accounts for scroll position** to handle clicks on scrolled content
3. **Calculates line number** from Y coordinate: `line = floor((y + scrollTop) / lineHeight)`
4. **Calculates column number** from X coordinate: `column = floor(x / charWidth)`
5. **Sets cursor position** using the new `setCursorPosition()` method

### 3. Editor Implementation
Added three new methods to the `Editor` class:

- `setCursorPosition(line, column)`: Sets cursor to specific position with bounds checking
- `getScrollTop()`: Returns current scroll offset
- `getLineHeight()`: Delegates to renderer's line height
- `getCharWidth()`: Delegates to renderer's character width

## Key Features

✅ **Accurate positioning**: Uses the same lineHeight and charWidth as the renderer
✅ **Bounds checking**: Cursor is clamped to valid line and column positions
✅ **Scroll-aware**: Correctly handles clicks when content is scrolled
✅ **Clears selection**: Selection is cleared when clicking (standard editor behavior)

## Usage
Simply click anywhere in the editor canvas, and the cursor will jump to that position!

## Future Enhancements
- [ ] Click-and-drag text selection
- [ ] Double-click to select word
- [ ] Triple-click to select line
- [ ] Shift+click to extend selection
