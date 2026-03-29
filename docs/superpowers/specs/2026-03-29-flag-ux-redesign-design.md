# Flag UX Redesign Design Spec

## Goal

Make the flag-based step counting experience intuitive for 5th-grade students by surfacing flags directly in the right panel, replacing the cryptic flip switch with labeled mode cards, and providing clear in-context guidance when FLAGS mode is active.

## Background

Three UX problems with the current implementation:
1. **Flag buried in library** — "Step Flag" sits among dominoes, balls, and toy cars. It's a planning annotation tool, not a material.
2. **Flip switch is cryptic** — Tiny "AUTO / FLAGS" labels with no description give students no signal about what switching does.
3. **No guidance after switching** — Toggling to FLAGS mode shows "0 of 5+ flags" with nothing telling students what to do next.

---

## Section 1: Right Panel Structure

### Steps becomes a full sub-section

"Steps" gets an `<h3>` header identical in style to "Requirements" and "Bill of Materials". The current `#step-mode-header` div and its flip switch are removed.

**New Steps section DOM structure (inside `#tracker`):**

```html
<h3>Steps</h3>
<div id="step-mode-cards">
  <button class="mode-card" id="mode-card-auto" data-mode="auto">
    <span class="mode-card-title">AUTO</span>
    <span class="mode-card-desc">Counts connections</span>
  </button>
  <button class="mode-card" id="mode-card-flags" data-mode="flags">
    <span class="mode-card-title">FLAGS</span>
    <span class="mode-card-desc">You mark steps</span>
  </button>
</div>
<div id="step-counter"></div>
<div id="flag-drag-widget" class="lib-item" data-subtype="flag" data-type="marker" data-default-w="8" data-default-h="24" hidden>
  <!-- SVG flag icon + label rendered by tracker-ui.js -->
</div>
```

### Mode cards

Two side-by-side tappable buttons replace the flip switch:
- **AUTO card**: title "AUTO", description "Counts connections"
- **FLAGS card**: title "FLAGS", description "You mark steps"
- Active card: `1.5px solid` border + colored title — AUTO active: teal `#00c9a7` border + title; FLAGS active: red `#ef476f` border + title
- Inactive card: `1px solid #1a3a5c` border, dim title `#2a4a6a`, opacity 0.5
- Clicking a card sets `state.mode` and re-renders (same as the current click handler, retargeted)

### Step counter

Unchanged in position and size (30px Orbitron number). Label updates: "of 5+ steps" in AUTO, "of 5+ flags" in FLAGS. Color logic unchanged.

### Flag drag widget

Visible only when `state.mode === 'flags'`. Hidden (`hidden` attribute) in AUTO mode.

- Has class `lib-item` and the same `data-subtype`, `data-type`, `data-default-w`, `data-default-h` attributes as library items — the **existing library drag handler covers it with zero new drag code**
- Styled with a dashed red border to signal it's draggable
- Contains a small SVG flag icon (same as the library icon, drawn via `drawFlagIcon`)
- Shows the next flag number (current flag count + 1), updated on every `updateTrackerUI()` call
- Label: "STEP FLAG / Drag to canvas"

---

## Section 2: Left Library Changes

The `flag` entry is removed from the `CATALOG.materials` array in `js/main.js`. Step Flag no longer appears in the left library under Materials.

No other library changes.

---

## Section 3: Behavior

- **Mode switching**: Clicking a mode card calls `setState({ mode })` and `render()` — identical to the current `#mode-switch` click handler, just retargeted to `.mode-card` buttons
- **Flags on canvas**: Flags placed in FLAGS mode remain visible on canvas when switching to AUTO mode. AUTO mode ignores them for counting; they can still be moved, deleted, or annotated
- **Flag drag widget number**: Always shows `(current flag count) + 1`. If 0 flags placed, shows "1". If 3 placed, shows "4". Updates on every render
- **Drag behavior**: Dragging the widget onto the canvas places a new flag at drop position, numbered automatically at render time — no change to flag placement or numbering logic

---

## Files Modified

| File | Change |
|---|---|
| `index.html` | Replace `#step-mode-header` + button with `#step-mode-cards` + `#flag-drag-widget`; version bump |
| `style.css` | Remove flip switch styles; add `.mode-card`, `#step-mode-cards`, `#flag-drag-widget` styles |
| `js/tracker-ui.js` | Update `updateTrackerUI()`: set active mode card, show/hide flag widget, update widget flag number |
| `js/main.js` | Remove `flag` from `CATALOG.materials`; retarget mode click handler from `#mode-switch` to `.mode-card[data-mode]` |

`js/drag.js`, `js/render/materials.js`, `js/tracker.js`, `js/state.js` — **no changes needed**.

---

## Out of Scope

- Canvas overlay prompt when in FLAGS mode ("Place a flag here")
- Tooltip or info popover (mode card descriptions provide sufficient context)
- Keyboard shortcut to add a flag
- Any change to flag rendering, numbering, or comment behavior
