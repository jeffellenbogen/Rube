# v3.0.1 Improvements Design

**Date:** 2026-04-05  
**Version target:** v3.0.1  
**Status:** Approved

---

## Overview

Four small improvements to the Rube Goldberg Planner:

1. PNG materials panel uses full page height, with graceful overflow clipping
2. On-screen BOM list sorts by display label (matching the PNG export order)
3. Current app version embedded in PNG metadata and shown on the printout
4. Rotate and reflect UI buttons exposed for `chair` and `desk` environment items

---

## 1. PNG Materials Panel — Full Height + Overflow Clipping

### Problem
The right-side panel in the downloaded PNG is anchored to `mainY` (below the header area) and only extends `mainH` pixels. With enough materials, items overflow the panel border and get clipped by the page edge, cutting off at ~7–8 visible items.

### Design
- Expand the panel to span from `MARGIN` to `PAGE_H - MARGIN` — the full usable page height.
- All content (`pY` starting point, panel border `strokeRect`, `panelBottom` sentinel) use this taller region.
- In `panelSection`, before drawing each item, check if `pY + ROW_H > panelBottom`. If so, render `"…and X more"` in muted gray at that position and `break` out of the loop.
- The "X more" count is the number of remaining items that didn't fit.

### Files changed
- `js/export.js`: adjust `mainY`, `mainH`, panel `strokeRect`, add `panelBottom` guard in `panelSection`

---

## 2. On-Screen BOM — Sort by Display Label

### Problem
`getBOM` in `tracker.js` sorts by subtype key (e.g. `matchboxTrack`, `box`, `toyCar`). The display labels differ (`Car Track`, `Crate`, `Toy Car`), so the visible order on screen doesn't match alphabetical by label. The PNG export already sorts by display label correctly.

### Design
- In `tracker.js`, after building `counts`, map each key to its display label before sorting.
- `ITEM_LABELS` is already defined in `tracker-ui.js`; to avoid a circular import, duplicate the minimal label map inside `tracker.js` (it's already a small constant).
- Sort `Object.entries(counts)` by display label: `ITEM_LABELS[name] || name`.
- Return `{ name, count }` where `name` is still the subtype key (so `tracker-ui.js` can still do its own label lookup — no downstream changes needed).

### Files changed
- `js/tracker.js`: add local `ITEM_LABELS` constant, sort by display label

---

## 3. Version on Printout

### Problem
There is no record of which app version last touched a saved design. Students and teachers can't tell which version produced a given PNG.

### Design

**State field:** Add `meta.savedWithVersion` (string). Not set on old PNGs — treated as `undefined` (backwards compatible).

**On download:** Before injecting PNG metadata, read the version string from `document.getElementById('version-label').textContent` (e.g. `"v3.0.1"`) and write it to `exportState.meta.savedWithVersion`.

**On the printout:** After the Steps section, render a small label at the very bottom of the right panel:
```
Saved with v3.0.1
```
Rendered in muted blue-gray (`#4a7a9a`), small font (11px), right-aligned inside the panel.

**On upload:** The field is preserved in state as-is (it was set at download time). If the user re-downloads without changes, the version is updated to the current app version at download time.

### Files changed
- `js/export.js`: read version label, write to `exportState.meta.savedWithVersion`, render footer text

---

## 4. Rotate and Reflect for Chair and Desk

### Problem
`chair` and `desk` environment items already store `rotation` and `flipped` in state, and `environment.js` applies those transforms. However, the rotate (↻) and flip (↢) action buttons in `render/ui.js` are gated on `isComp` (only shown for canvas components, not env items). Additionally, when both `flipped` and `rotation` are set, `environment.js` only applies rotation and ignores the flip.

### Design

**UI buttons (`render/ui.js`):**
- After the existing `isComp` rotate/flip block, add a second block: `if (isEnv && (envItem.subtype === 'chair' || envItem.subtype === 'desk'))`.
- Show the same rotate ↻ button (bottom-right of selection ring) and flip ↢ button (bottom-left).
- Use the same `data-action="rotate"` / `data-action="flip"` attributes — the existing handlers in `main.js` already support env items, so no changes needed there.

**Combined flip + rotation (`render/environment.js`):**
- Current logic: `if (item.flipped && !rotation) { flip } else if (rotation) { rotate }` — flip is lost when rotation is set.
- New logic: always compose both transforms when both are present.
  - Flip only: `translate(cx,cy) scale(-1,1) translate(-cx,-cy)`
  - Rotation only: `rotate(deg,cx,cy)` (unchanged)
  - Both: `translate(cx,cy) rotate(deg) scale(-1,1) translate(-cx,-cy)` — rotate first in local space, then flip
- `cx`/`cy` are the component center in SVG px.

### Files changed
- `js/render/ui.js`: add rotate + flip buttons for `chair`/`desk` env items
- `js/render/environment.js`: fix combined flip+rotation transform

---

## Backwards Compatibility

- `meta.savedWithVersion` is a new optional field. Old PNGs lacking it load fine — the field is simply absent, and the printout footer is omitted (or shows nothing) for those files.
- No existing state fields are renamed or removed.
- The `flipped`/`rotation` fix in `environment.js` is purely a rendering change — state shape is unchanged.
