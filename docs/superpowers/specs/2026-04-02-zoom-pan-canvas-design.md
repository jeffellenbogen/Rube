# Phase 1: Zoom, Pan & Canvas Standardization — Design Spec

Date: 2026-04-02
Status: Awaiting user approval

---

## Problem

1. **Zoom is broken.** Pinch-to-zoom on a trackpad zooms the entire browser window — including the left component panel and right tracker panel. There is no way to zoom only the build canvas.
2. **Canvas size is unpredictable.** The canvas scale is computed once at page load based on the browser window size. Students on different screens — or the same student who resizes their window — get different-sized design areas, and the floor/start/finish markers end up in different positions.

---

## Goals

- Pinch gesture zooms the canvas only, not the browser chrome
- Two-finger scroll pans the canvas
- Left panel, right panel, and header are completely unaffected
- All students start with the same canvas world size regardless of screen or window size
- Floor line, start marker, and finish marker are visible in the default (zoom=1, pan=0) view
- Start and finish markers remain draggable as they are today
- Existing saved PNGs load correctly after this change (backwards compatibility)

---

## Architecture

### Viewport Transform Model

Today, `canvas.js` computes a single `scale` (px per cm) at init and never changes it. Coordinate conversions (`screenToCanvas`, `cmToPx`, etc.) are linear and stateless.

The new model adds two viewport state variables to `canvas.js`:

```
viewZoom   — number, default 1.0, clamped to [0.25, 4.0]
viewPanX   — cm, default 0
viewPanY   — cm, default 0
```

The **base scale** (`basePx`) is computed once at init from the wrapper size and the fixed world dimensions (see below). It never changes after that. All rendering uses:

```
px = (cm + pan) * basePx * zoom
```

And screen-to-canvas conversion becomes:

```
cm = (screenPx / (basePx * zoom)) - pan
```

### SVG Viewport Group

All five layer groups in `index.html` are wrapped in a single `<g id="viewport">`. The renderer applies a single SVG `transform` to this group on every render:

```
transform="translate(panXpx, panYpx) scale(zoom)"
```

where `panXpx = viewPanX * basePx` and `panYpx = viewPanY * basePx`.

This means **rendering code in all render/*.js files does not change** — they still place elements at `cmToPx(x)`, `cmToPx(y)`. The viewport group's transform handles zoom and pan automatically.

The only code that changes is:
- `canvas.js` — adds viewport state, updates `screenToCanvas` / `canvasToScreen`, exports viewport controls
- `drag.js` — no changes to coordinate math (it already uses `screenToCanvas`)
- `index.html` — wrap layers in `<g id="viewport">`
- `main.js` — attach `wheel` event listener to the SVG element
- `comments.js` — comment bubble positions must recompute when viewport changes (already hooks into `onViewChange`)
- `export.js` — export renders the canvas at zoom=1, pan=0 (reset viewport for export, restore after)

### Fixed World Size

The canvas world is fixed at **800cm × 450cm** regardless of screen size.

At init, `basePx` is computed to fit the world width in the available wrapper width:
```
basePx = wrapperWidth / 800
```

On a 13" MacBook Air at default browser zoom with panels open, the wrapper is approximately 900–1000px wide, giving `basePx ≈ 1.1–1.25 px/cm`. This produces a canvas height of `450 * 1.2 ≈ 540px`, which fits comfortably in the viewport.

The floor line Y position is fixed at **400cm** in canvas-world coordinates. This places it near the bottom of the default view with comfortable margin. (Previously `getFloorPx()` returned a pixel value derived from window height — this is replaced with a constant world-space Y.)

### Start and Finish Markers

Start and finish markers default to fixed canvas-world positions:
- Start: `x=10cm, y=400cm` (left side, at floor)
- Finish: `x=790cm, y=400cm` (right side, at floor)

These positions are stored in state (as they are today) so students can drag them. On loading an old PNG, if the saved positions are outside the new world bounds they are clamped — this is the only migration needed for backwards compatibility.

---

## Gesture Handling

### Wheel Event on SVG Element

```js
svgEl.addEventListener('wheel', onWheel, { passive: false });

function onWheel(e) {
  e.preventDefault(); // blocks browser zoom and page scroll

  if (e.ctrlKey) {
    // Pinch-to-zoom (Mac trackpad fires ctrlKey=true for pinch)
    zoomAtPoint(e.clientX, e.clientY, -e.deltaY * 0.01);
  } else {
    // Two-finger scroll → pan
    panBy(-e.deltaX / (basePx * viewZoom), -e.deltaY / (basePx * viewZoom));
  }
}
```

`{ passive: false }` is required for `preventDefault()` to work on wheel events.

### Zoom At Point

Zoom is centered on the cursor position so the point under the cursor stays fixed:

```
1. Convert cursor to canvas coords before zoom: (curCm)
2. Apply new zoom
3. Adjust pan so curCm maps to the same screen position
```

This is the standard "zoom to cursor" algorithm and feels natural on trackpads.

### Zoom Limits

- Minimum: 0.25× (see the full 800cm world at once)
- Maximum: 4.0× (close detail work)

---

## Comment Bubble Repositioning

Comment bubbles are DOM elements absolutely positioned over the SVG. They already listen to `onViewChange` for scroll. The viewport change (zoom or pan) must also fire `onViewChange` so bubbles reposition correctly.

---

## Export Compatibility

The PNG export renders a blueprint at a fixed layout. Before capturing, the export temporarily resets `viewZoom=1, viewPan=0,0` and calls `render()`. After the PNG is generated it restores the previous viewport. The exported PNG looks identical to today — this is invisible to students.

The saved state in the PNG `iTXt` chunk does **not** include viewport state (zoom/pan). Viewport always resets to default on load. No state schema change needed.

---

## Backwards Compatibility

- Old PNGs load without changes. Component `x/y` coordinates are in cm and remain valid in the new world.
- The floor line Y changes from a dynamic pixel value to a fixed world-space value. If an old PNG has components placed near the old floor position, they remain where they are — only the floor line itself moves slightly. This is acceptable.
- Start/finish marker positions stored in old PNGs are clamped to world bounds if needed (edge case — unlikely to trigger).

---

## Version

First code commit bumps version to **v2.6.0** in `index.html`.

---

## Files Changed

| File | Change |
|------|--------|
| `js/canvas.js` | Add viewport state, zoom/pan functions, update coordinate conversions, replace `getFloorPx()` with constant |
| `js/main.js` | Attach `wheel` listener to SVG |
| `index.html` | Wrap layer groups in `<g id="viewport">`, bump version to v2.6.0 |
| `js/comments.js` | Fire `onViewChange` on viewport change (already wired) |
| `js/export.js` | Reset viewport before export, restore after |
| `js/render/index.js` | Apply viewport transform to `#viewport` group on each render |

---

## Reset View Button

A small "fit to screen" icon button is rendered directly on the canvas area (not in the side panels). Clicking it resets `viewZoom=1, viewPan=0,0` and re-renders.

**Placement:** Top-right corner of the canvas wrapper, overlaid with `position: absolute`. Small enough to be unobtrusive but easy to find when a student is lost.

**Appearance:** A standard "fit/home" SVG icon (consistent with existing action button styling). No label needed — icon is self-explanatory and a tooltip can confirm on hover.

**Visibility:** Always visible, not just when zoomed. This avoids students having to discover it only after they're already confused.

This adds one entry to the Files Changed table: `index.html` gets the button markup, and a small click handler is wired in `main.js`.

---

## Out of Scope for This Phase

- Touch support beyond trackpad
- Saving viewport state to PNG
