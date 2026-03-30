# Multi-Select Design Spec

## Goal

Allow students to drag a rubber-band rectangle over the canvas to select multiple components, then move them as a group or delete them all at once. Shift-click lets them add or remove individual components from the selection.

## Background

Currently the canvas supports single-component selection only (`selected: string | null` in `js/drag.js`). Moving several components to a new area requires repeated individual drags. Bulk delete requires repeated individual deletes. Multi-select is a standard canvas affordance that would make layout work significantly faster.

---

## Section 1: Scope

**In scope:**
- Rubber-band drag on empty canvas to select multiple machines and materials
- Shift-click to toggle individual components in/out of the selection
- Shift + rubber-band to add to an existing selection
- Dragging any selected component moves all selected components by the same delta
- Delete/Backspace removes all selected components at once
- Escape or click-on-empty-canvas clears the selection

**Out of scope:**
- Environment items (desks, shelves, tables, couches) — not selectable via multi-select
- Copy/paste of selections
- Rotating or resizing a group
- Surface snapping during group drag (snapping only makes sense for a single component)

---

## Section 2: Interaction Model

### Rubber-band selection

Mousedown on empty canvas (no component under cursor) begins a rubber-band drag. A teal dashed rectangle with a faint fill tracks the pointer. On mouseup, every machine or material whose axis-aligned bounding box overlaps the rubber-band rectangle is added to `selectedIds`.

A mouseup within 5px of the mousedown position in both axes is treated as a click on empty space, not a rubber-band: it clears the selection.

### Shift-click

Mousedown on a component while Shift is held toggles that component in/out of `selectedIds` without starting a drag. No movement occurs.

Shift held during a rubber-band drag: intersecting components are added to `selectedIds` rather than replacing it.

### Group drag

Mousedown on a component that is already in `selectedIds` (without Shift) starts a group drag. All selected components move by the same pixel delta. `undoPush()` is called on the first movement, as with single-component drag. Surface snapping is disabled for group drags.

Mousedown on a component that is NOT in `selectedIds` (without Shift) clears the selection and selects only that component — existing single-select behavior.

### Deselection

Clicking empty canvas (no rubber-band, pointer moves < 5px) clears `selectedIds`. Pressing Escape clears `selectedIds`.

### Delete

Delete or Backspace with two or more items in `selectedIds` removes all of them. Components with `subtype === 'start'` or `subtype === 'finish'` are skipped. After deletion, `selectedIds` is cleared.

---

## Section 3: Visual Feedback

### During rubber-band drag

A live rectangle rendered on the SVG canvas:
- Stroke: `#00c9a7`, `stroke-width: 1.5`, `stroke-dasharray: 6 3`
- Fill: `rgba(0, 201, 167, 0.08)`
- No `rx` — sharp corners

### When 2+ components are selected (Option C)

**Per-component ring:** a teal dashed rect around each selected component's bounding box (accounting for rotation). Same shape as the existing single-select ring but slightly thinner.
- Stroke: `#00c9a7`, `stroke-width: 1.5`, `stroke-dasharray: 5 3`, `opacity: 0.8`

**Group bounding box:** one outer rect enclosing all selected components with 8px padding.
- Stroke: `#00c9a7`, `stroke-width: 2`, `stroke-dasharray: 8 5`
- Fill: `rgba(0, 201, 167, 0.05)`
- `rx: 4`

When exactly 1 component is in `selectedIds`, existing single-select UI is unchanged (orange dashed ring, action buttons, resize handles, sub-part handles).

---

## Section 4: Architecture

### Files modified

| File | Change |
|---|---|
| `js/drag.js` | Replace `selected` with `selectedIds[]`; add rubber-band and group drag logic |
| `js/render/ui.js` | Render multi-select rings, group bounding box, and live rubber-band rect |
| `js/main.js` | Update delete key handler to remove all selected components |

No new files. No changes to `js/state.js`, `style.css`, or `index.html` (version bump aside).

### State changes in `js/drag.js`

```js
// Before
let selected = null;

// After
let selectedIds = [];         // replaces selected
let rubberBand = null;        // { startX, startY, currentX, currentY } in screen px (from mouse events), or null
let groupDrag = null;         // { startX, startY, startPositions: Map<id,{x,y}> } or null
```

**Exports added/changed:**

```js
// Backward-compatible single-select accessors (used by action buttons, handles)
export function getSelected()      { return selectedIds[0] ?? null; }
export function setSelected(id)    { selectedIds = id ? [id] : []; }

// Multi-select accessors
export function getSelectedIds()   { return selectedIds; }
export function setSelectedIds(ids){ selectedIds = [...ids]; }

// Rubber-band for renderer
export function getRubberBand()    { return rubberBand; }
```

### Rubber-band intersection (pure function, testable)

The caller converts `rubberBand` (screen px) to cm using `pxToCm()` before passing to this function.

```js
function getComponentsInRect(components, rect) {
  // rect: { x, y, width, height } in cm — caller converts from screen px via pxToCm()
  // Uses axis-aligned bounding box (ignores rotation) for simplicity.
  // The rendered per-component ring follows rotation; the intersection check does not.
  // Returns array of component IDs whose bounding box overlaps rect
  return components
    .filter(c => c.type === 'simple_machine' || c.type === 'material')
    .filter(c => {
      return c.x < rect.x + rect.width  &&
             c.x + c.width  > rect.x    &&
             c.y < rect.y + rect.height &&
             c.y + c.height > rect.y;
    })
    .map(c => c.id);
}
```

### Mousedown logic (updated)

```
if (Shift held AND component hit):
  toggle component in selectedIds → render → return

if (no component hit):
  start rubberBand drag → return

if (component hit AND component in selectedIds AND !Shift):
  start groupDrag with all selectedIds → return

if (component hit AND !Shift):
  clear selectedIds, select this component → existing single-select drag
```

### Group drag (mousemove)

```js
if (groupDrag) {
  const dx = pos.x - groupDrag.startX;
  const dy = pos.y - groupDrag.startY;
  if (!hasMoved) { undoPush(); hasMoved = true; }
  for (const [id, orig] of groupDrag.startPositions) {
    updateComponent(id, { x: orig.x + dx, y: orig.y + dy });
  }
  render();
}
```

### Delete key handler update (`js/main.js`)

```js
const ids = getSelectedIds();
if (ids.length > 1) {
  const s = getState();
  ids.forEach(id => {
    if (s.components.find(c => c.id === id &&
        (c.subtype === 'start' || c.subtype === 'finish'))) return;
    removeComponent(id);
  });
  setSelectedIds([]);
  render();
  return;
}
// existing single-select delete path follows...
```

---

## Section 5: Tests

`getComponentsInRect` is a pure function and should be unit-tested:
- Empty components returns `[]`
- Component fully inside rect → included
- Component partially overlapping rect → included
- Component fully outside rect → excluded
- Environment items excluded regardless of position

---

## Out of Scope (explicit)

- No copy/paste
- No group rotate/resize
- No multi-select for environment items
- No drag handles on the group bounding box
