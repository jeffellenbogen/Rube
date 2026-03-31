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
    attachPoints.js — computes attachment point pixel positions
    ui.js           — selection rings, handles, action buttons, rubber-band rect

  test/
    run.js          — test runner
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
