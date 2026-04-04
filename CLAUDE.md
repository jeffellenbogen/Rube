# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Rube Goldberg Machine Planner** — a browser-based visual planning tool for 5th-grade students to design their Rube Goldberg machines before physically building them. The full PRD is in `Rube-Goldberg-Planner-PRD.md`.

**Current status:** Feature-complete at v2.5.x. The project is in maintenance and polish mode — fixing bugs, refining UX, and adding small quality-of-life improvements. All P0 features from the PRD are shipped.

## Tech Stack

**Single-page HTML/JS app with no backend, no build step, no framework.** Students open a URL — no server infrastructure, no login, no database. All files are plain static HTML, CSS, and ES modules served directly from GitHub Pages.

- `index.html` — app shell, sidebar, canvas wrapper, CSS
- `app.js` — thin entry point (legacy, mostly superseded by `js/main.js`)
- `icons.js` — SVG icon helpers

## File Structure

```
js/
  main.js           — app init, keyboard shortcuts, drag/drop from library, action dispatch
  state.js          — single source of truth; all mutations go through here
  drag.js           — all pointer interaction: single drag, connDrag, rubberBand, groupDrag, handleDrag
  canvas.js         — scale, coordinate conversion (screenToCanvas, cmToPx, etc.)
  connections.js    — connection creation, deletion, step counting logic
  multi-select.js   — pure utility: getComponentsInRect (testable in Node)
  undo.js           — undo/redo stack (snapshot-based)
  comments.js       — comment bubble overlays (textarea DOM elements)
  tracker.js        — step/machine requirement tracking logic
  tracker-ui.js     — renders tracker sidebar UI
  welcome.js        — welcome modal
  help.js           — help modal

  render/
    index.js        — orchestrates full render(); call this to repaint everything
    machines.js     — draws simple machine SVG icons
    materials.js    — draws material SVG icons
    environment.js  — draws environment items (desk, chair, etc.)
    connections.js  — draws energy connection lines and connDrag ghost
    attachPoints.js — getAttachPx: live pixel positions used for rendering (cord tips); getSnapPx: snap-target positions (pulley cord ends moved to wheel rim so snapping works from any approach direction). Always use getSnapPx in findNearestAttachment; use getAttachPx for rendering only.
    ui.js           — selection rings, handles, action buttons, rubber-band rect

  test/
    run.js          — test runner
    multi-select.test.js — tests for getComponentsInRect
    snap.test.js    — tests for getSnapPx and findNearestAttachment snap behavior
    *.test.js       — unit tests (Node-compatible, no browser deps)
```

## Core Architecture

### State
All app state lives in `js/state.js` and is never mutated directly — every change goes through an exported function (`addComponent`, `updateComponent`, `removeComponent`, etc.). State is a plain JS object; undo works by snapshotting it with `JSON.parse(JSON.stringify(...))`.

### Rendering
`render()` in `js/render/index.js` repaints the entire canvas from state. It is synchronous and idempotent — call it freely after any state change. All SVG layers are cleared and rebuilt each call. There is no virtual DOM or diffing.

### Pointer Interaction
All mouse/pointer logic is in `js/drag.js`. Five drag states are tracked as module-level variables:
- `dragging` — single component body drag
- `connDrag` — energy connection drag (from teal attachment point dot)
- `rubberBand` — multi-select rect drag (starts on empty canvas click)
- `groupDrag` — moving a multi-select group
- `handleDrag` — sub-part handles (fulcrum, resize, cord ends, etc.)

Only one is active at a time. `mousedown` is on `svgEl`; `mousemove` and `mouseup` are on `window`.

### Connections (Energy Links)
Connections live in `state.connections[]`. Each has `fromId`, `fromPoint`, `toId`, `toPoint`. Rendering is in `js/render/connections.js`; creation/deletion in `js/connections.js`. Step counting uses a graph walk in `js/connections.js → countSteps()`.

### Coordinate System
Canvas uses **centimeters** as the internal unit. `cmToPx` / `pxToCm` / `screenToCanvas` in `js/canvas.js` handle all conversions. Component `x`, `y`, `width`, `height` are all in cm.

## PNG Export and Import

The app saves and loads projects via PNG files that carry the full project state invisibly embedded as metadata. This is the only persistence mechanism — there is no server, no JSON download, no separate file.

### Export (`js/export.js → downloadPNG`)

Clicking "Download" renders a **print-ready blueprint PNG** and injects the project state into it:

**Page format:** Landscape letter at 300 DPI — 11" × 8.5". The HTML Canvas is created at 3300×2550 px (1650×1275 logical, then `ctx.scale(2,2)` for crispness on high-DPI screens). This size is chosen to print cleanly on a standard letter-size sheet in landscape orientation.

**Layout:**
- **Header** — "RUBE GOLDBERG PLAN" title, team name, and today's date across the top
- **Canvas area** (left, ~80% of width) — the SVG canvas serialized and drawn via `XMLSerializer` → `Image` → `ctx.drawImage`; any open comment bubbles are rendered as callout boxes overlaid on the canvas
- **Materials panel** (right, fixed 260px wide) — three sections:
  - *Simple Machines* — checkbox list of all 6 machine types, ticked/teal if the student has placed that type
  - *Materials* — bill of materials (quantity × name), alphabetically sorted, environment items excluded
  - *Steps* — step count vs. 5+ target, labeled AUTO or FLAGS depending on current mode

**Metadata:** After `canvas.toBlob()`, the PNG binary is parsed manually. The full `state` object is JSON-serialized and injected as a **PNG `iTXt` chunk** with keyword `RubeGoldbergState`, inserted immediately before the first `IDAT` chunk. CRC-32 is computed in JS. This produces a valid standard PNG that any image viewer opens normally, while silently carrying the project data.

**Filename:** `{team-name}-plan.png` (team name sanitized, spaces → hyphens).

### Import (`js/export.js → uploadPNG`)

Clicking "Upload" reads the PNG binary, scans its chunks for an `iTXt` chunk with keyword `RubeGoldbergState`, decodes the JSON, and validates `state.version === 2`. On success the full project state is restored exactly as saved. Files without the metadata (or with a version mismatch) show a descriptive error.

### Key constraint
The PNG is the **only** save format. Don't add a separate JSON export without a clear reason — the embedded-metadata approach keeps everything in one file that students can email, print, or re-upload without managing separate files.

## Deployment Workflow

- **`main` branch** → GitHub Pages (live, public URL). Never commit directly to main for features.
- **`New-Features` branch** → active development branch. All feature work and bug fixes go here first.
- When a feature or fix is ready: open a PR from `New-Features` → `main`, review, merge manually. Keep `New-Features` alive after merging — don't delete it.
- After merging, pull `main` locally if needed; next work resumes on `New-Features`.

## Version Convention

Every commit that ships a user-visible change must bump the version label in `index.html`:

```html
<div id="version-label">v2.5.46</div>
```

- **Patch** (v2.5.x) — bug fixes, small polish
- **Minor** (v2.x.0) — new features or significant behavior changes

The version label is the only visible confirmation that a GitHub Pages deploy has gone live. Always update it — forgetting causes confusion when hard-refreshing to verify a deploy.

## Key Coding Conventions

- **No framework, no build step** — vanilla JS ES modules only. Don't introduce dependencies.
- **Keyboard shortcuts** — the global `keydown` handler in `main.js` guards with `if (tag === 'INPUT' || tag === 'TEXTAREA') return;` at the top. Any new shortcuts must respect this guard.
- **Drag state hygiene** — always null out drag state variables (`connDrag`, `rubberBand`, etc.) before calling `render()` in mouseup handlers, so the render sees the final clean state.
- **`e.buttons === 0` guard** — mousemove handlers for drag states check `e.buttons === 0` to cancel stale state when the mouse re-enters after being released outside the browser.
- **Chromebook target** — all interactions must work via trackpad/mouse. No hover-only affordances. No touch-specific code needed, but trackpad quirks (accidental multi-touch, cursor leaving window mid-drag) should be handled gracefully.

## Backwards Compatibility

**Existing saved designs must always load.** Students save their work as PNG files and return to them days or weeks later. Any feature that changes state shape, adds required fields, or alters the PNG metadata format must maintain full read compatibility with all prior versions.

Specifically:
- PNG files saved at any prior version must upload and restore correctly after a code change
- New state fields must have safe defaults so old PNGs (which lack those fields) still work
- Never change the `iTXt` chunk keyword (`RubeGoldbergState`) or the `state.version` validation logic without a migration path
- If a new feature requires a state schema change, add optional fields with defaults — never remove or rename existing fields that may appear in saved files
- Test uploads of old PNGs after any state or export change before shipping

## Constraints

- Must run on Chromebooks in Chrome
- No personal data collection, no authentication
- Physics simulation is explicitly out of scope — planning tool only
- No backend, no login, no database

## Keeping This File Current

Propose updates to CLAUDE.md when:
- A significant new file or module is added to the codebase
- A new workflow convention is established
- A major feature area is shipped that changes how the codebase is navigated
- An architectural pattern changes

Do **not** propose updates for individual bug fixes, version bumps, or anything already captured in the memory system.
