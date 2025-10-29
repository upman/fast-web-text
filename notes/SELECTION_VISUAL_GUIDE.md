# Text Selection Visual Guide

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User Actions                                │
│  • Click & Drag Mouse                                                │
│  • Shift + Click                                                     │
│  • Shift + Arrow Keys                                                │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      InputHandler.ts                                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Mouse Events:                                                  │  │
│  │  - handleMouseDown()  → editor.startSelection()               │  │
│  │  - handleMouseMove()  → editor.updateSelection()              │  │
│  │  - handleMouseUp()    → finalize selection                    │  │
│  │  - handleClick()      → with Shift: extend selection          │  │
│  │                                                                │  │
│  │ Keyboard Events:                                              │  │
│  │  - handleKeydown()    → Shift+Arrows: moveCursorWithSelection│  │
│  │                       → Normal keys: clear selection          │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Editor.ts                                    │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Selection Methods:                                            │  │
│  │  • startSelection(line, col)   → SelectionManager            │  │
│  │  • updateSelection(line, col)  → SelectionManager            │  │
│  │  • clearSelection()            → SelectionManager            │  │
│  │  • moveCursorWithSelection()   → move + update selection     │  │
│  │                                                               │  │
│  │ Render Loop:                                                  │  │
│  │  1. Render text (WebGPU)                                      │  │
│  │  2. Render selection (SelectionRenderer)                      │  │
│  │  3. Render cursor                                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────┬───────────────────────────┬───────────────────────────┘
              │                           │
              ▼                           ▼
┌─────────────────────────┐  ┌───────────────────────────────────────┐
│  SelectionManager.ts    │  │     SelectionRenderer.ts              │
│  ┌───────────────────┐  │  │  ┌─────────────────────────────────┐ │
│  │ State:            │  │  │  │ Rendering:                      │ │
│  │  • anchor: {      │  │  │  │  • Creates DOM overlay divs     │ │
│  │      line,        │  │  │  │  • Calculates rectangle bounds  │ │
│  │      column       │  │  │  │  • Applies blue background      │ │
│  │    }              │  │  │  │  • Handles multi-line spans     │ │
│  │  • head: {        │  │  │  │  • Updates on scroll/render     │ │
│  │      line,        │  │  │  │                                 │ │
│  │      column       │  │  │  │ Visual Style:                   │ │
│  │    }              │  │  │  │  background: rgba(100,149,237,  │ │
│  │                   │  │  │  │              0.3)               │ │
│  │ Methods:          │  │  │  │  position: absolute             │ │
│  │  • getSelection() │  │  │  │  pointer-events: none           │ │
│  │  • hasSelection() │  │  │  │  z-index: 1                     │ │
│  └───────────────────┘  │  │  └─────────────────────────────────┘ │
└─────────────────────────┘  └───────────────────────────────────────┘
```

## Selection State Flow

### Starting a Selection (Mouse Down)

```
User Mouse Down
      ↓
getMousePosition(event)
      ↓
{ line: 5, column: 10 }
      ↓
editor.startSelection(5, 10)
      ↓
selectionManager.startSelection({ line: 5, column: 10 })
      ↓
anchor = { line: 5, column: 10 }
head = { line: 5, column: 10 }
      ↓
editor.requestRender()
```

### Extending Selection (Mouse Move)

```
User Drags Mouse
      ↓
getMousePosition(event)
      ↓
{ line: 7, column: 20 }
      ↓
editor.updateSelection(7, 20)
      ↓
selectionManager.updateSelection({ line: 7, column: 20 })
      ↓
anchor = { line: 5, column: 10 }  (unchanged)
head = { line: 7, column: 20 }    (updated)
      ↓
editor.requestRender()
      ↓
selectionRenderer.render()
      ↓
Creates divs for lines 5, 6, 7 with blue highlight
```

## Rendering Example

### Single Line Selection

```
Line 5: "const editor = new Editor(container, canvas);"
         ^^^^^^^^^^^^^^
         Selected region

anchor: { line: 5, column: 6 }
head:   { line: 5, column: 20 }

Renders:
┌─────────────────────────────────────────┐
│ const editor = new Editor(container,... │
│       ████████████████                  │  ← Blue highlight
└─────────────────────────────────────────┘
```

### Multi-Line Selection

```
Line 5: "const editor = new Editor(container, canvas);"
                        ███████████████████████████████
Line 6: "await editor.initialize(content);"
        ███████████████████████
Line 7: "console.log('initialized');"
        ███████

anchor: { line: 5, column: 20 }
head:   { line: 7, column: 7 }

Renders three separate divs:
┌─────────────────────────────────────────┐
│ const editor = new Editor(container,... │
│                    █████████████████████ │  ← Line 5: col 20 to end
│ await editor.initialize(content);       │
│ ████████████████████████████████████████ │  ← Line 6: full line
│ console.log('initialized');             │
│ ███████                                  │  ← Line 7: start to col 7
└─────────────────────────────────────────┘
```

## Code Structure

### SelectionManager State

```typescript
class SelectionManager {
  private anchor: Position | null = null;
  private head: Position | null = null;

  // Example state after user selects from (5,10) to (7,20):
  // anchor = { line: 5, column: 10 }
  // head = { line: 7, column: 20 }

  getSelection(): Selection | null {
    // Returns normalized selection where start < end
    return {
      start: { line: 5, column: 10 },  // Earlier position
      end: { line: 7, column: 20 }     // Later position
    };
  }
}
```

### SelectionRenderer DOM Structure

```html
<div id="editor-container">
  <canvas id="editor-canvas"></canvas>
  
  <!-- SelectionRenderer creates this overlay -->
  <div style="position: absolute; top: 0; left: 0; z-index: 1;">
    <!-- One div per selected line -->
    <div style="position: absolute; left: 200px; top: 90px; width: 300px; height: 18px; background: rgba(100,149,237,0.3);"></div>
    <div style="position: absolute; left: 0px; top: 108px; width: 500px; height: 18px; background: rgba(100,149,237,0.3);"></div>
    <div style="position: absolute; left: 0px; top: 126px; width: 70px; height: 18px; background: rgba(100,149,237,0.3);"></div>
  </div>
  
  <!-- CursorRenderer element -->
  <div class="cursor" style="position: absolute; ..."></div>
</div>
```

## Event Flow Timeline

```
Time  Event                   Handler                 Action
───────────────────────────────────────────────────────────────────────
  0   User clicks at (5,10)   handleMouseDown()       startSelection(5,10)
                                                      anchor = (5,10)
                                                      head = (5,10)
                                                      render()

 50   User drags to (5,15)    handleMouseMove()       updateSelection(5,15)
                                                      head = (5,15)
                                                      render()

100   User drags to (6,20)    handleMouseMove()       updateSelection(6,20)
                                                      head = (6,20)
                                                      render()

150   User releases button    handleMouseUp()         isMouseDown = false
                                                      Selection finalized

200   User presses Shift+→    handleKeydown()         moveCursorWithSelection(0,1)
                                                      head = (6,21)
                                                      render()

250   User presses →          handleKeydown()         moveCursor(0,1)
                                                      clearSelection()
                                                      render()
```

## Browser Dev Tools Inspection

When selection is active, you can inspect in browser console:

```javascript
// In browser console:
const container = document.getElementById('editor-container');
const overlay = container.querySelector('div[style*="z-index: 1"]');
const selectionDivs = overlay.querySelectorAll('div');

console.log('Number of selected lines:', selectionDivs.length);

selectionDivs.forEach((div, i) => {
  console.log(`Line ${i}:`, {
    left: div.style.left,
    top: div.style.top,
    width: div.style.width,
    height: div.style.height
  });
});
```
