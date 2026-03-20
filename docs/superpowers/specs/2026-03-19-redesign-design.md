# Rube Goldberg Planner — Redesign Spec

**Date:** 2026-03-19
**Status:** Approved
**Author:** Jeff Ellenbogen

---

## Overview

A ground-up redesign of the Rube Goldberg Machine Planner. The new version replaces abstract icon cards with realistic, interactive cartoon SVG components in a side-elevation classroom view. Students can manipulate sub-parts of each simple machine directly (drag a fulcrum, adjust cord lengths, tilt a ramp), place environment furniture as surfaces, and plan gravity-dependent chain reactions. The app remains a single-page vanilla HTML/CSS/JS app with no backend, no login, and no data collection.

---

## Goals (unchanged from PRD)

1. Enable visual planning of Rube Goldberg machines before physical build
2. Reinforce understanding of the six simple machines
3. Track project requirements (3+ machine types, 5+ cause/effect steps)
4. Produce a shareable, printable plan
5. Run on Chromebooks in Chrome, no account required

---

## Tech Stack

- Vanilla HTML5, CSS3, JavaScript (ES6+)
- SVG-first rendering (no canvas element, no framework)
- No build step — served via `npx serve`
- External dependencies (CDN only):
  - `html2canvas` replaced by native SVG serialization for PNG export
  - Google Fonts: Orbitron + JetBrains Mono (retained)

---

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  TOOLBAR: Team name | Undo | Redo | Download | Upload   │
├──────────────┬──────────────────────────┬───────────────┤
│              │                          │  Requirements │
│  Component   │     SVG Canvas           │  Tracker      │
│  Library     │  (side elevation view)   │               │
│              │                          │  Bill of      │
│  - Machines  │                          │  Materials    │
│  - Materials │                          │               │
│  - Environ.  │                          │               │
└──────────────┴──────────────────────────┴───────────────┘
```

- **Left sidebar:** Component library with three collapsible sections (Simple Machines, Materials, Environment). Each item shows a small cartoon SVG preview + name. Drag items onto the canvas.
- **Center:** Full SVG canvas, side elevation view. Pan by dragging background. Zoom via scroll wheel or trackpad pinch.
- **Right sidebar:** Requirements tracker (checklist + step counter) + bill of materials. Fixed position, updates live.
- **Toolbar (top):** Team name (editable text field), Undo, Redo, Download, Upload. No file-type labels on Download/Upload.

---

## Canvas Architecture

### Rendering

The canvas is a single `<svg>` element filling the center zone. All content is SVG — no DOM cards, no HTML overlays on the canvas.

**Layer structure (SVG `<g>` groups, back to front):**

1. **Environment layer** — floor line, room ceiling, desks, chairs, stairs, shelves, bookshelves, couches
2. **Machine layer** — simple machines and materials, each as a `<g>` with sub-parts
3. **Connection layer** — cords, push arrows, and fall lines between attachment points
4. **UI layer** — selection rings, resize handles, snap indicators, delete buttons, comment bubbles

### Coordinate System

Real-world centimeters mapped to pixels via a zoom-adjustable scale (default: 1 cm = 4 px). This lets students reason in real-world sizes. A standard desk is ~75 cm tall; the default room is ~800 cm wide × 300 cm tall.

### Side Elevation View

The canvas represents a room cross-section viewed from the side. The bottom of the canvas is the floor (always present, thick line, not draggable). The top is the ceiling. Gravity is implied downward.

### Canvas Expansion

- Default: full classroom width visible in the browser window
- Students can expand left or right by up to 50% of the default canvas width on each side (maximum total = 2× default width)
- Expansion triggered by dragging a component near the canvas edge — a dashed border + expand arrow button appears
- Expansion increments: 25% at a time, up to the 50% limit per side
- Floor and ceiling lines extend with the canvas
- Expansion is not undoable (canvas size only grows)

### Pan & Zoom

- Pan: click-drag on the canvas background
- Zoom: scroll wheel or two-finger pinch
- Right sidebar and toolbar remain fixed during pan/zoom

---

## Component Model

Every machine component in the SVG is structured as:

```xml
<g class="component" data-id="..." data-type="lever">
  <g class="body">        <!-- cartoon SVG drawing -->
  <g class="handles">     <!-- draggable sub-part handles -->
  <g class="attachments"> <!-- snap points for connections -->
  <g class="ui">          <!-- delete btn, comment bubble, resize handles -->
</g>
```

### Visual Style

Flat cartoon icons — friendly, colorful, clearly representational of the real object. Not photographic. Not schematic/blueprint. Consistent stroke weight and palette across all components.

### Scaling

Every component has corner resize handles when selected. Dragging a corner scales the whole component proportionally. The SVG viewBox of each component group scales with it.

### Comments

Each component has a chat bubble icon in the UI layer. Clicking toggles a speech-bubble overlay with an editable textarea. The comment is visible in its current toggle state (shown/hidden) in exports. Students can collapse the bubble; a small indicator shows text exists. Comments are stored per component in the state.

---

## Simple Machines & Sub-Parts

| Machine | Draggable Sub-Parts | Attachment Points |
|---------|--------------------|--------------------|
| **Lever** | Fulcrum slides left/right along bar | Left end, right end |
| **Pulley** | Left cord end, right cord end (drag to lengthen/attach) | Left cord end, right cord end, mounting point (top) |
| **Inclined Plane** | Angle handle (arc drag to tilt ramp) | Top end, bottom end |
| **Wheel & Axle** | Rotation handle (shows spin direction arrow) | Axle left, axle right |
| **Wedge** | Width/height resize handles | Thin end, thick base |
| **Screw** | Rotation handle | Top, tip |

---

## Materials (Components)

Standard materials — one input point, one output point, no sub-part handles:

dominoes, ball, toy car, string, cup, bucket, tube, box, cardboard, tape, magnet, track, yardstick, protractor, matchbox car track

**Yardstick:** Long thin rectangle, scalable length, attachment points at both ends and center.
**Protractor:** Semicircle shape, attachment point at center base.
**Matchbox car track:** Orange H-track profile, connectable end-to-end, angle-adjustable like the inclined plane.

### Custom Item

A placeholder component (box with "?" icon and speech bubble). When placed, immediately prompts the student to type a name via an inline input. Once named:
- Displays the custom name as its label
- Added to bill of materials under that name
- Has one input + one output attachment point
- Can be renamed by double-clicking the label

Lives at the bottom of the Materials section in the library. Multiple custom items with different names are supported.

---

## Environment Items

Environment items are placed as the "stage" before adding machine components. They are **surfaces**, not steps.

- No attachment points
- Not counted in bill of materials or step chain
- Each shelf/surface level acts as a valid resting surface for components
- Resizable (drag edges); repositionable freely

| Item | Notes |
|------|-------|
| **Floor** | Always present. Bottom of canvas. Not draggable or deletable. |
| **Desk** | Flat horizontal surface + legs. Adjustable width. |
| **Chair** | Seat + back + legs. Scalable. Seat and armrests are valid surfaces. |
| **Stairs** | 3–8 steps (drag handle to add/remove). Railing on one side. Each step is a surface. |
| **Shelf** | Wall-mounted flat surface. Can attach to canvas edge or float. |
| **Bookshelf** | Tall vertical unit with multiple horizontal shelf levels. Each shelf is a surface. |
| **Couch** | Seat surface + back + arms. Seat and armrests are valid surfaces. |

### Surface Snapping

When a machine component is dragged near the top of any surface (desk, chair seat, stair step, shelf, etc.), it snaps flush to that surface. Hold Shift to override and place freely (mid-air).

---

## Gravity Awareness (Planning Aid)

When a machine component is placed without a surface beneath it, a dashed vertical line drops from its base to the nearest surface below — a visual "fall line" showing where the item would land. This is a planning aid only; no physics are simulated.

Students use fall lines intentionally (e.g., plan a ball rolling off a desk edge, dropping into a cup on the floor). Fall lines are included in exports.

---

## Connections & Cause/Effect Steps

### Model

A connection links one component's output attachment point to another's input attachment point. Each connection = one cause/effect step.

```javascript
{ id, fromId, fromPoint, toId, toPoint }
```

The step chain is traced from the START marker through sequential connections to the FINISH marker.

### Snapping

When a student drags a cord endpoint or attachment handle within ~15 px of another component's attachment point, it snaps and a connection record is created. A visual cord or push arrow is drawn in the Connection layer. Right-click a connection line to delete it.

### START & FINISH Markers

Two special non-deletable components anchored to the canvas:
- **START** (green, left side) — one output attachment point
- **FINISH** (red, right side) — one input attachment point

Students can reposition them anywhere on the canvas. The step count only registers connections in the chain from START → FINISH.

---

## Requirements Tracker

**Simple machine checklist:** One checkbox per machine type (6 total). Auto-ticks when at least one of that type is placed. 3+ ticked = green/complete.

**Step counter:** Counts connections in the START → FINISH chain. 5+ = green/complete. Unconnected components don't count.

**Bill of materials:** Live alphabetical tally of all placed machine/material components (including custom items by name). Environment items excluded. Updates automatically as components are added/removed.

---

## Undo / Redo

- Command stack, max 50 actions
- Every state-mutating action pushes to the stack: place, move, delete, connect, disconnect, resize, rename, sub-part drag, comment edit
- Toolbar buttons + keyboard shortcuts: Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)
- Stack is not persisted — resets on page load

---

## Download / Upload (Session Persistence)

### Download (PNG with embedded JSON)

The Download button exports the canvas as a PNG. The full project state JSON is embedded in the PNG's `iTXt` metadata chunk (UTF-8 text, ~60 lines of vanilla JS binary manipulation — no library needed).

- The PNG is a normal image viewable everywhere (Google Drive, Classroom, email, print)
- Comments are exported in their current toggle state (shown/hidden as-is on canvas)
- The embedded JSON is invisible to anyone viewing the image
- The team name appears as a header in the exported image

### Upload (Restore Session)

The Upload button accepts a PNG file previously exported by this app. On upload:
1. Read PNG binary
2. Extract the `iTXt` chunk containing the JSON state
3. Restore full canvas state (components, environment, connections, comments, comment visibility, sub-part positions, canvas expansion)

If the PNG has no embedded JSON (e.g., a screenshot), show a friendly error: "This image doesn't contain a saved project. Try uploading a file you downloaded from this app."

### Future Path

The SVG-first canvas architecture makes a future SVG export option straightforward — the state JSON can be embedded in an SVG `<metadata>` tag with minimal changes.

---

## Data Model

```javascript
{
  meta: {
    title: "Team Rocket's Machine",  // team name, shown in export header
    scale: 4,                         // px per cm at zoom=1
    canvasExpansion: { left: 0, right: 0 }  // fraction expanded (0–0.5)
  },
  environment: [
    {
      id,
      subtype: "desk" | "chair" | "stairs" | "shelf" | "bookshelf" | "couch",
      x, y,          // position (cm)
      width, height, // dimensions (cm)
      stepCount: 3   // stairs only: number of steps
    }
  ],
  components: [
    {
      id,
      type: "simple_machine" | "material",
      subtype: "lever" | "pulley" | "domino" | "custom" | ...,
      name: "",      // custom items only: student-given name
      x, y,          // position (cm)
      width, height, // scaled dimensions (cm)
      subParts: {
        // lever:         { fulcrumOffset: 0.4 }        (fraction along bar)
        // pulley:        { leftCordLength: 80, rightCordLength: 60 }
        // inclinedPlane: { angle: 30 }                 (degrees)
        // wheelAxle:     { spinDirection: "cw" | "ccw" }
      },
      comment: "",
      commentVisible: false
    }
  ],
  connections: [
    { id, fromId, fromPoint, toId, toPoint }
  ]
}
```

---

## File Compatibility

The new save format is intentionally incompatible with v1 (the existing app). The structural differences are too large to bridge gracefully. A clean break is the right call. If a user uploads an old v1 JSON, show a friendly message: "This project was saved with an older version of the planner and can't be opened here."

---

## Out of Scope

- Physics simulation (gravity, momentum, friction)
- Multiplayer / real-time collaboration
- User accounts or login
- Mobile / touch-first design
- Chain reaction animation (P2 future consideration)
