# Text Selection Implementation

## Overview
This document describes the text selection implementation added to fast-web-text, based on VS Code's selection architecture.

## Architecture

### Components

#### 1. SelectionManager (`src/input/SelectionManager.ts`)
- **Purpose**: Manages selection state with anchor and head positions
- **Key Methods**:
  - `startSelection(position)`: Begins a new selection at the given position
  - `updateSelection(position)`: Updates the selection head to a new position
  - `clearSelection()`: Removes the current selection
  - `getSelection()`: Returns normalized selection with start < end
  - `hasSelection()`: Checks if there's an active selection
  - `isPositionInSelection(position)`: Tests if a position is within the selection

#### 2. SelectionRenderer (`src/rendering/SelectionRenderer.ts`)
- **Purpose**: Visually renders selection highlights using DOM overlays (similar to VS Code)
- **Implementation**: Creates absolutely positioned div elements with semi-transparent background
- **Key Methods**:
  - `render(selectionManager, scrollTop, lineContent)`: Renders selection rectangles for each selected line
  - `updateDimensions(lineHeight, charWidth)`: Updates font metrics
  - `clear()`: Removes all selection visuals

#### 3. InputHandler Updates (`src/input/InputHandler.ts`)
- **New Features**:
  - Mouse drag selection (mousedown → mousemove → mouseup)
  - Shift+Click to extend selection
  - Shift+Arrow keys for keyboard selection
  - Mouse leave handling to stop dragging
- **State Tracking**:
  - `isMouseDown`: Tracks if mouse button is pressed
  - `isDragging`: Tracks if user is actively dragging to select

#### 4. Editor Updates (`src/core/Editor.ts`)
- **New Methods**:
  - `startSelection(line, column)`: Initiates selection from mouse/keyboard
  - `updateSelection(line, column)`: Updates selection end point
  - `clearSelection()`: Clears the selection
  - `moveCursorWithSelection(deltaLine, deltaCol)`: Moves cursor while maintaining/extending selection
  - `getCursorPosition()`: Returns current cursor position
  - `getSelectionManager()`: Exposes selection manager for external access
  - `setCursorPositionWithoutClearingSelection(line, column)`: Moves cursor without clearing active selection (used during mouse drag)

## User Interactions

### Mouse Selection

#### Click and Drag
1. User presses mouse button (mousedown)
2. `InputHandler.handleMouseDown()` calls `editor.startSelection()` at click position
3. User moves mouse while holding button
4. `InputHandler.handleMouseMove()` calls `editor.updateSelection()` with new position
5. User releases mouse button (mouseup)
6. Selection is finalized

#### Shift+Click
1. User holds Shift and clicks
2. `InputHandler.handleClick()` detects shift key
3. Calls `editor.updateSelection()` to extend from current cursor to click position
4. Preserves existing selection anchor

### Keyboard Selection

#### Shift+Arrow Keys
1. User holds Shift and presses arrow key
2. `InputHandler.handleKeydown()` detects shift modifier
3. Calls `editor.moveCursorWithSelection()`
4. If no selection exists, starts one from current cursor
5. Updates selection as cursor moves

**Supported Keys with Shift**:
- Arrow Up/Down/Left/Right
- Home/End

### Selection Clearing

Selection is cleared when:
- User clicks without Shift
- User presses arrow keys without Shift
- User types text (insertText)
- User deletes text (deleteText)

## Rendering Pipeline

```
1. User Action (mouse/keyboard)
   ↓
2. InputHandler updates SelectionManager state
   ↓
3. Editor.requestRender() triggered
   ↓
4. Render loop:
   - Render text (WebGPU)
   - Render selection highlights (DOM overlay)
   - Render cursor (DOM element)
```

## Visual Appearance

- **Selection Color**: `rgba(100, 149, 237, 0.3)` (semi-transparent cornflower blue)
- **Rendering Order**: Selection is rendered BEFORE cursor so cursor is always visible
- **Multi-line**: Each line gets its own selection rectangle
- **Partial Lines**: First and last lines respect start/end column positions

## VS Code Comparison

### Similar to VS Code
✅ Anchor and head position model
✅ DOM-based selection rendering
✅ Mouse drag selection
✅ Shift+Click to extend
✅ Shift+Arrow for keyboard selection
✅ Selection clears on cursor movement without Shift

### Simplified from VS Code
- VS Code uses `GlobalEditorPointerMoveMonitor` for tracking mouse outside editor
- VS Code has rounded selection corners (CornerStyle)
- VS Code supports multiple selections (multi-cursor)
- VS Code has advanced drag-and-drop text support
- Our implementation uses simple rectangular highlights

## Future Enhancements

### Potential Improvements
1. **Copy/Cut/Paste**: Add clipboard operations for selected text
2. **Delete Selection**: When selection exists, typing should replace selected text
3. **Double-Click**: Select word under cursor
4. **Triple-Click**: Select entire line
5. **Ctrl+A**: Select all text
6. **Multiple Cursors**: VS Code-style multi-cursor editing
7. **Rounded Corners**: VS Code-style rounded selection appearance
8. **Drag and Drop**: Drag selected text to move it
9. **Outside Editor Dragging**: Continue selection when dragging outside viewport
10. **WebGPU Selection**: Render selection in WebGPU instead of DOM for better performance

## Testing

### Manual Testing Checklist
- [ ] Click and drag to select text
- [ ] Selection highlights visible lines correctly
- [ ] Shift+Click extends selection from cursor
- [ ] Shift+Arrow keys create/extend selection
- [ ] Arrow keys without Shift clear selection
- [ ] Typing text clears selection
- [ ] Multi-line selection spans correctly
- [ ] Selection respects line boundaries
- [ ] Mouse leave stops dragging
- [ ] Selection updates on scroll

### Edge Cases to Test
- [ ] Selection at start/end of document
- [ ] Selection with very long lines
- [ ] Rapidly dragging mouse
- [ ] Selecting backwards (right to left)
- [ ] Empty lines in selection
- [ ] Selection with different font sizes

## References

### VS Code Source Files (in ../vscode)
- `/src/vs/editor/common/core/selection.ts` - Selection model
- `/src/vs/editor/browser/viewParts/selections/selections.ts` - Selection rendering
- `/src/vs/editor/browser/controller/mouseHandler.ts` - Mouse event handling
- `/src/vs/editor/browser/editorDom.ts` - Mouse position tracking

### Implementation Files (in this project)
- `src/input/SelectionManager.ts` - Selection state management
- `src/rendering/SelectionRenderer.ts` - Visual rendering
- `src/input/InputHandler.ts` - User input handling
- `src/core/Editor.ts` - Main editor integration
