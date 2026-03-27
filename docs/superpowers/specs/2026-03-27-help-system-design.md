# HELP System Design

**Date:** 2026-03-27
**Project:** Rube Goldberg Machine Planner
**Status:** Approved

## Overview

A modal-based HELP system for 5th-grade students. Triggered by a toolbar button, it opens a centered overlay with two tabs: a paginated getting-started tutorial and a scrollable quick-reference grid. All content is defined in a JS data structure for easy editing.

---

## Trigger

A `? HELP` button is added to the right side of the existing toolbar (`#toolbar` in `index.html`), alongside the Download and Upload buttons. Clicking it opens the modal.

---

## Modal Structure

- Centered overlay with a semi-transparent dark backdrop (`rgba(0,0,0,0.7)`)
- Modal panel: fixed width (~620px), max height 80vh, scrollable content area
- Header bar: `? HELP` title on left, `✕` close button on right
- Two tabs below the header: `GETTING STARTED` and `QUICK REFERENCE`
- Closes on ✕ click or backdrop click
- Does not close on Escape (students on Chromebooks may hit it accidentally)

---

## Tab 1 — Getting Started

Five paginated cards. Each card has:
- A mini SVG illustration (left, ~140×110px) drawn in the app's existing schematic style (dark bg, `#1a3a5c` borders, `#ff7b2e` accent)
- A step label (`STEP N OF 5`), bold title, and 2–3 sentence description (right)
- Prev / Next navigation buttons and dot progress indicators

### Card Content

| # | Title | Illustration | Description |
|---|-------|-------------|-------------|
| 1 | Welcome | Three-panel canvas overview with labels | Introduces the library panel (left), canvas (center), and requirements tracker (right). Explains this is a planning tool — draw your machine before you build it. |
| 2 | Adding Components | Drag arrow from left panel to canvas with a desk/lever on canvas | Drag any item from the left panel onto the canvas. Simple Machines are in the top section; Materials and Environment items are below. Click a placed item to select and move it. |
| 3 | Connecting Steps | Two components with a connector node highlighted and an arrow between them | Click the orange connector dot on one component, then click a dot on another to create a link. Each link = one step in your machine. Links show up as lines between components. |
| 4 | The Checklist | Right-panel tracker with checkmarks filling in | The Requirements panel tracks your progress. You need at least 3 different simple machine types and 5 or more connected steps. The checklist updates automatically as you build. |
| 5 | Saving & Loading | Download icon and upload icon side by side | Click Download to save your blueprint as a PNG image. To keep working on a saved plan, click Upload and select the `.png` file — your full plan loads back onto the canvas. |

---

## Tab 2 — Quick Reference

Scrollable content divided into three labeled sections. Each entry shows the component's SVG icon (reused from the existing library rendering) + name + one short description line. The items listed below reflect the current CATALOG — at implementation time, verify against the actual CATALOG entries in `js/main.js` and update descriptions to match.

### Sections

**Simple Machines** (6 entries)
- Lever — A bar that pivots on a fulcrum to lift or launch objects
- Pulley — A wheel and rope that redirects force or lifts loads
- Wedge — An angled ramp that splits, lifts, or redirects objects
- Wheel & Axle — A wheel on a rod that rolls or transfers rotation
- Inclined Plane — A sloped surface that objects roll or slide down
- Screw — A spiral ramp that converts rotation into linear motion

**Materials** (9 entries)
- Ball — Rolls along surfaces and down ramps
- Domino — Tips over and knocks into the next object
- Toy Car — Rolls along surfaces; can be pushed by other components
- Bucket — Can hold objects; tips when weighted
- Cup — Smaller container; tips or transfers contents
- Tube — Guides balls or objects through a path
- Box (Crate) — A solid block for stacking or stopping objects
- Book — Can be stacked to build platforms or placed on a shelf
- Cardboard — A flat surface for ramps or dividers

**Environment** (5 entries)
- Desk — A wide flat surface to build on
- Chair — A raised seat surface with lower arm height
- Stairs — A stepped surface; use the flip button to face left or right
- Bookshelf — An upright or horizontal shelf (use rotate); books snap to shelves
- Couch — A soft surface with seat and arm levels

---

## Implementation Plan

### Files to create
- `js/help.js` — modal open/close logic, tab switching, card navigation, content data array

### Files to modify
- `index.html` — add `? HELP` button to toolbar; add modal HTML scaffold
- `style.css` — modal overlay, backdrop, tab styles, card layout, reference grid
- `js/main.js` — import and initialize help module

### Content data structure (in `js/help.js`)

```js
const GETTING_STARTED = [
  {
    title: 'Welcome',
    step: 1,
    description: '...',
    drawIllustration(svg) { /* SVG drawing code */ }
  },
  // ...5 total
];

const QUICK_REFERENCE = [
  { section: 'Simple Machines', items: [
    { subtype: 'lever', name: 'Lever', desc: 'A bar that pivots on a fulcrum...' },
    // ...
  ]},
  // ...
];
```

Icons in Quick Reference are rendered by calling the existing `drawMachineIcon` / `drawMaterialIcon` / `drawEnvIcon` functions from the render modules — no new drawing code needed.

### Modal HTML (in `index.html`)

```html
<div id="help-modal" class="help-hidden">
  <div id="help-backdrop"></div>
  <div id="help-panel">
    <div id="help-header">
      <span>? HELP</span>
      <button id="help-close">✕</button>
    </div>
    <div id="help-tabs">
      <button class="help-tab active" data-tab="guide">GETTING STARTED</button>
      <button class="help-tab" data-tab="ref">QUICK REFERENCE</button>
    </div>
    <div id="help-body"></div>
  </div>
</div>
```

`help.js` renders tab content into `#help-body` dynamically — no static HTML for cards or reference entries.

---

## Out of Scope

- Animated illustrations (static SVG only)
- Teacher-specific content or setup guide
- Tooltips or inline contextual help
- Search within help content

---

## Success Criteria

- A student who has never used the tool can complete a 5-step plan after reading the Getting Started cards
- The Quick Reference answers "what does this component do?" without needing to experiment
- The modal does not interfere with any canvas state (undo history, selections, placed components)
