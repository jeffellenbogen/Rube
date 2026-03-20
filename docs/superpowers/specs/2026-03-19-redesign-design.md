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
  - Google Fonts: Orbitron + JetBrains Mono

**PNG export implementation (no library needed):**
1. Serialize the SVG element to a string via `XMLSerializer`
2. Draw the SVG string onto an HTML `<canvas>` via `Image` + `canvas.drawImage()`
3. Export canvas as PNG `ArrayBuffer` via `canvas.toBlob()` + `FileReader`
4. Manually inject an `iTXt` chunk containing the JSON state into the PNG binary (PNG chunk format is a 4-byte length + 4-byte type + data + 4-byte CRC; insert before the first `IDAT` chunk — approximately 60 lines of vanilla JS)
5. Trigger download via a temporary `<a>` element with a Blob URL

This approach requires no CDN library. The PNG chunk spec is well-documented and the manipulation is self-contained.

---

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  TOOLBAR: [Team Name field] | Undo | Redo | Download | Upload  │
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
- **Center:** Full SVG canvas, side elevation view. Pan by dragging background. Zoom via scroll wheel or trackpad pinch. See "Pan & Zoom" for disambiguation from component drag.
- **Right sidebar:** Requirements tracker (checklist + step counter) + bill of materials. Fixed position, updates live.
- **Toolbar (top):**
  - **Team name:** Inline click-to-edit text input. Defaults to "Team Name". Appears as a header in the exported PNG. Editable after upload.
  - **Undo / Redo** buttons
  - **Download** button (no file type label)
  - **Upload** button (no file type label)

---

## Canvas Architecture

### Rendering

The canvas is a single `<svg>` element filling the center zone. All content is SVG — no DOM cards, no HTML overlays on the canvas (except comment textareas — see Comments section).

**Layer structure (SVG `<g>` groups, back to front):**

1. **Environment layer** — floor line, room ceiling, desks, chairs, stairs, shelves, bookshelves, couches
2. **Machine layer** — simple machines and materials, each as a `<g>` with sub-parts
3. **Connection layer** — cords, push arrows, and fall lines between attachment points
4. **UI layer** — selection rings, resize handles, snap indicators, delete buttons, comment bubble icons

### Coordinate System

Real-world centimeters mapped to pixels via a zoom-adjustable scale (default: 1 cm = 4 px). This lets students reason in real-world sizes. A standard desk is ~75 cm tall; the default room is ~800 cm wide × 300 cm tall.

### Side Elevation View

The canvas represents a room cross-section viewed from the side. The bottom of the canvas is the floor (always present, thick line, not draggable or deletable). The top is the ceiling. Gravity is implied downward.

### Canvas Expansion

- Default: full classroom width visible in the browser window
- Students can expand left or right by up to 50% of the default canvas width on each side (maximum total = 2× default width)
- Expansion triggered by dragging a component near the canvas edge — a dashed border + expand arrow button appears
- Expansion increments: 25% at a time, up to the 50% limit per side
- Floor and ceiling lines extend with the canvas
- **Canvas expansion is explicitly excluded from the undo stack.** It is a one-way, permanent operation within a session. Undoing the action that triggered the expansion affordance does NOT shrink the canvas — the canvas size and the component action undo independently.

### Pan & Zoom

- **Pan:** click-drag on any empty area of the canvas background (not over a component, handle, or attachment point). The cursor changes to a grab cursor when hovering over a pannable area.
- **Zoom:** scroll wheel or two-finger pinch on trackpad
- Component drags originating from the sidebar are distinct interaction events (dragstart on a sidebar element) and cannot be confused with canvas pan gestures.
- Right sidebar and toolbar remain fixed during pan/zoom.

---

## Component Model

Every machine component in the SVG is structured as:

```xml
<g class="component" data-id="..." data-type="lever">
  <g class="body">        <!-- cartoon SVG drawing -->
  <g class="handles">     <!-- draggable sub-part handles -->
  <g class="attachments"> <!-- snap points for connections -->
  <g class="ui">          <!-- delete btn, comment bubble icon, resize handles -->
</g>
```

### Visual Style

Flat cartoon icons — friendly, colorful, clearly representational of the real object. Not photographic. Not schematic/blueprint. Consistent stroke weight and palette across all components.

### Scaling

Every component has corner resize handles when selected. Dragging a corner scales the whole component proportionally (maintains aspect ratio). **When a component is scaled, all sub-part positions scale proportionally with the component bounding box** — with one exception: **pulley cord lengths (`leftCordLength`, `rightCordLength`) are not affected by component scale.** Cord lengths represent how far the cord extends into the room, which is independent of the pulley wheel size. Scaling the pulley resizes the wheel; the cords retain their stored lengths. All other sub-parts (fulcrum offset, ramp angle, screw angle) scale or are dimensionless fractions unaffected by resize.

### Comments

Each component has a chat bubble icon in the SVG UI layer. Clicking the icon toggles a comment overlay.

- **Overlay implementation:** A floating HTML `<div>` (not SVG `foreignObject`) positioned absolutely over the canvas. Its position is computed from the component's SVG bounding box transformed to screen coordinates, and recalculated on pan/zoom events via `requestAnimationFrame` throttling (at most once per frame) to avoid layout thrashing during fast gesture input.
- **Content:** An editable `<textarea>`. Max 200 characters.
- **Collapsed state:** Bubble icon shows a small filled indicator dot when the comment contains text.
- **Export:** Comments are exported in their current toggle state (visible or hidden) as-is on the canvas at export time.

---

## Simple Machines & Sub-Parts

### Attachment Point Identifiers

All attachment point IDs used in the connection data model:

| Component | Attachment Point IDs |
|-----------|---------------------|
| **Lever** | `left`, `right` |
| **Pulley** | `cordLeft`, `cordRight`, `mountTop` |
| **Inclined Plane** | `top`, `bottom` |
| **Wheel & Axle** | `axleLeft`, `axleRight` |
| **Wedge** | `thinEnd`, `thickBase` |
| **Screw** | `top`, `tip` |
| **Yardstick** | `left`, `center`, `right` |
| **Protractor** | `base` |
| **Matchbox car track** | `left`, `right` |
| **All other materials** | `input`, `output` |
| **Custom item** | `input`, `output` |
| **START marker** | `output` |
| **FINISH marker** | `input` |

### Sub-Part Interactions Per Machine

| Machine | Draggable Sub-Parts | Sub-Part Data | Attachment Points |
|---------|--------------------|--------------|--------------------|
| **Lever** | Fulcrum triangle slides left/right along bar | `{ fulcrumOffset: 0.4 }` (fraction 0–1 along bar) | `left`, `right` |
| **Pulley** | Left cord end, right cord end (drag up/down to lengthen/shorten; drag to snap to another attachment point) | `{ leftCordLength: 80, rightCordLength: 60 }` (cm; not affected by component scale — see Scaling) | `cordLeft`, `cordRight`, `mountTop` |
| **Inclined Plane** | Angle handle at top corner; arc-drag to tilt the ramp | `{ angle: 30 }` (degrees, 0–80) | `top`, `bottom` |
| **Wheel & Axle** | Rotation direction indicator — **click-to-toggle**, not drag; shows a circular arrow on the wheel face indicating CW or CCW spin direction | `{ spinDirection: "cw" \| "ccw" }` | `axleLeft`, `axleRight` |
| **Wedge** | Width/height resize handles (drag edges, not corners — corners are shared with the global resize handles) | *(shape captured by width/height in component root)* | `thinEnd`, `thickBase` |
| **Screw** | Rotation direction indicator — **click-to-toggle**, shows a spiral arrow indicating CW or CCW; also has an angle handle to tilt the screw axis | `{ spinDirection: "cw" \| "ccw", angle: 90 }` (angle in degrees: 0 = horizontal, 90 = vertical; range: 0–90) | `top`, `tip` |
| **Matchbox car track** | Angle handle at one end; arc-drag to tilt the track section | `{ angle: 0 }` (degrees, -45 to +45; 0 = flat/horizontal) | `left`, `right` |

**Wheel & Axle and Screw rotation direction:** In a static planning tool, the spin direction arrow is a visual annotation helping students communicate "the wheel spins this way to push/pull the next object." It does not affect any calculation — it is a planning label. Clicking the rotation indicator cycles between `"cw"` and `"ccw"` and flips the arrow graphic.

---

## Materials (Components)

Standard materials — one `input` point, one `output` point, no sub-part handles, unless noted:

dominoes, ball, toy car, string, cup, bucket, tube, box, cardboard, tape, magnet, track

**Yardstick:** Long thin rectangle. Scalable length. Attachment points at `left`, `center`, `right`. No sub-part handles — scale using the global resize handle.

**Protractor:** Semicircle shape. Attachment point at `base` (center of the flat edge). Primarily a visual planning reference; one attachment point for connecting into a chain.

**Matchbox car track:**
- Visual: orange H-track profile (the standard Matchbox/Hot Wheels look)
- Attachment points: `left` and `right` ends
- Angle: has an angle handle (same as Inclined Plane) to tilt the track section; sub-part data: `{ angle: 0 }` (degrees, -45 to +45)
- End-to-end connection: when the `right` attachment of one track piece is snapped to the `left` of another, they visually join flush (no gap, no push-arrow drawn — they render as a connected track segment). This is still a standard connection record in the data model.
- Each placed track piece is a separate component in the bill of materials (counted individually).

### Custom Item

A placeholder component (box outline with "?" icon and speech bubble indicator). When placed on the canvas, a small inline input immediately appears prompting the student to type a name. Once named:
- Displays the custom name as its label
- Added to bill of materials under that name
- Has `input` and `output` attachment points
- Can be renamed by double-clicking the label (shows inline input again)

Lives at the bottom of the Materials section in the library. Multiple custom items with different names are supported. Custom item sub-part data: none.

---

## Environment Items

Environment items are placed as the "stage" before adding machine components. They are **surfaces**, not steps.

- No attachment points
- Not counted in bill of materials or step chain
- Resizable (drag edges); repositionable freely
- Floor always present, not draggable, not deletable

| Item | Notes |
|------|-------|
| **Floor** | Always present. Bottom of canvas. Not draggable or deletable. Extends with canvas expansion. |
| **Desk** | Flat horizontal surface + legs. Adjustable width by dragging side edges. |
| **Chair** | Seat + back + legs. Scalable. Seat surface and armrest tops are valid snap surfaces for components. |
| **Stairs** | 3–8 steps. Step count adjusted by dragging the top resize handle — snaps to integer step counts. Railing is decorative (not a surface). Each individual step tread is a valid snap surface. |
| **Shelf** | Single flat horizontal surface. Can be positioned anywhere; visually shows mounting brackets on its back edge. |
| **Bookshelf** | Tall vertical unit with multiple fixed horizontal shelf levels (3 levels by default). Each shelf level is a valid snap surface. Overall height/width scalable. |
| **Couch** | Seat surface + back + two arms. Seat top and armrest tops are valid snap surfaces. |

### Surface Snapping

When a machine component is dragged within ~10 px of the top of any valid surface, it snaps flush to that surface. Hold **Shift** to override and place the component mid-air (ignores surface snapping).

---

## Gravity Awareness (Planning Aid)

When a machine component is placed without a valid surface beneath it (no surface within the component's bounding box footprint), a dashed vertical line drops from the component's base to the nearest surface directly below it (or to the floor if nothing else is present). This is a planning aid only — no physics are simulated.

Students use fall lines intentionally (e.g., plan a ball rolling off a desk edge, falling into a cup on the floor below). **Fall lines are included in PNG exports** to help teachers review plans and students reference them during the build phase. Fall lines are computed at render time from current component positions; they do not need to be stored in the data model.

---

## Connections & Cause/Effect Steps

### Connection Record

```javascript
{ id, fromId, fromPoint, toId, toPoint }
```

Each connection links one component's output attachment point to another's input attachment point. Each connection = one cause/effect step.

### Connection Visual Style

- **Cord/string line:** Used when either endpoint is a pulley cord point (`cordLeft`, `cordRight`), or when either component is the `string` or `matchbox car track` material. Rendered as a thin curved or straight line (no arrowhead).
- **Matchbox track join:** When `right` of one track snaps to `left` of another, no connector line is drawn — the components visually abut and the join is implied.
- **Push arrow:** Used for all other connections. Rendered as a short arrow line between the two attachment points.

### Creating Connections

Drag any attachment point handle (visible as a small colored circle on the component) within ~15 px of another component's attachment point → snaps and creates a connection record. A visual connector (cord or push arrow) is drawn in the Connection layer.

### Deleting Connections

- **Primary:** Click a connection line to select it (highlights in orange). Press `Delete` or `Backspace` to remove it.
- **Secondary:** A small **×** handle appears at the midpoint of a selected connection line. Click it to delete. (This ensures deletion is accessible without keyboard shortcuts on Chromebooks.)
- Right-click on a connection line also shows a context menu with "Delete connection" (right-click = two-finger tap on trackpad).

### START & FINISH Markers

Two special non-deletable components anchored to the canvas:
- **START** (green, default left side) — one `output` attachment point
- **FINISH** (red, default right side) — one `input` attachment point

Students can reposition them anywhere on the canvas. The step count only registers connections in the START → FINISH chain.

### Step Chain Traversal Algorithm

The step counter traverses the connection graph as a directed graph starting from the START marker:

1. Build an adjacency list: for each connection, map `fromId → toId`
2. Run a depth-first traversal from the START component using **branch-local visited sets** (standard backtracking DFS — a node marked visited in one branch is unmarked when that branch backtracks, so reconverging paths are explored correctly)
3. Count the number of edges (connections) in the longest path that reaches the FINISH component
4. If FINISH is not reachable from START, step count = 0

If a component has multiple outgoing connections (a fork), follow all branches and count the longest path to FINISH. Cycles are detected within a single DFS branch only (not globally), so a diamond topology (A→B→D, A→C→D) is handled correctly — both branches are explored. Unconnected components and disconnected sub-chains do not contribute to the step count.

---

## Requirements Tracker

**Simple machine checklist:** One checkbox per machine type (6 total). Auto-ticks when at least one of that type is placed on the canvas. 3+ ticked = shown in green as complete.

**Step counter:** Counts connections in the START → FINISH chain per the traversal algorithm above. 5+ = shown in green as complete.

**Bill of materials:** Live alphabetical tally of all placed machine/material components (including custom items by their given name). Environment items excluded. Updates automatically as components are added/removed.

---

## Undo / Redo

- Command stack, max 50 actions
- All state-mutating actions push to the stack: place component, move component, delete component, create connection, delete connection, resize component, rename component/custom item, sub-part drag (fulcrum, cord length, angle), spin direction toggle, comment edit, environment item add/move/resize/delete
- **Canvas expansion is explicitly excluded from the undo stack** (see Canvas Expansion section)
- Toolbar buttons: Undo, Redo
- Keyboard shortcuts: `Cmd/Ctrl+Z` (undo), `Cmd/Ctrl+Shift+Z` (redo)
- Stack resets on page load

---

## Download / Upload (Session Persistence)

### Download (PNG with embedded JSON)

The Download button exports the canvas as a PNG with the full project state JSON embedded invisibly in the PNG's `iTXt` metadata chunk.

**Implementation (vanilla JS, no library):**
1. Serialize the SVG element to string via `new XMLSerializer().serializeToString(svgEl)`
2. Draw it onto an offscreen `<canvas>` via `Image` + `drawImage()`
3. Export as PNG `ArrayBuffer` via `canvas.toBlob()` + `FileReader`
4. Parse the PNG binary: locate the first `IDAT` chunk by scanning for the 4-byte type marker
5. Construct an `iTXt` chunk: keyword `"RubeGoldbergState"`, UTF-8 JSON payload, CRC-32 checksum
6. Insert the `iTXt` chunk immediately before the first `IDAT` chunk in the ArrayBuffer
7. Trigger download via a temporary `<a href="blob:...">` element

Comments are exported in their current toggle state (visible or hidden as shown on canvas). The team name is rendered as a header above the canvas in the exported image.

### Upload (Restore Session)

The Upload button accepts:
- A PNG previously exported by this app (contains iTXt chunk with JSON)

On upload:
1. Read the file as `ArrayBuffer`
2. Verify PNG signature (first 8 bytes: `137 80 78 71 13 10 26 10`)
3. Scan chunks for an `iTXt` chunk with keyword `"RubeGoldbergState"`
4. Parse the UTF-8 JSON payload and restore full state

**On any upload error** (invalid file, no iTXt chunk, JSON parse failure, missing `version` key): the current canvas state is **not modified**. The error message is shown and the user remains on their existing canvas.

**V1 file detection:** A v1 file (old app format) will be a plain JSON file (not PNG) or a PNG without the `"RubeGoldbergState"` iTXt chunk. Detection: if the uploaded PNG has no matching iTXt chunk, or if an uploaded JSON file lacks a top-level `meta` key, show the error:

> "This file doesn't contain a saved project from this version of the planner. Make sure you're uploading a file you downloaded from this app."

### Future SVG Export Path

The SVG-first canvas architecture keeps a future SVG export option straightforward. The state JSON can be embedded in the SVG's `<metadata>` tag before serialization, producing a self-contained `.svg` file that is both the visual and the save file. This is a minimal code change when desired.

---

## Data Model

```javascript
{
  version: 2,   // used for format detection; v1 files lack this key
  meta: {
    title: "Team Name",              // team name shown in export header
    scale: 4,                        // px per cm at zoom=1
    canvasExpansion: { left: 0, right: 0 }  // discrete values only: 0, 0.25, or 0.5 (increments of 25%)
  },
  environment: [
    {
      id,
      subtype: "desk" | "chair" | "stairs" | "shelf" | "bookshelf" | "couch",
      x, y,          // position (cm from canvas origin)
      width, height, // dimensions (cm)
      stepCount: 4   // stairs only: integer 3–8
    }
  ],
  components: [
    {
      id,
      type: "simple_machine" | "material" | "marker",
      // type="simple_machine": lever, pulley, inclinedPlane, wheelAxle, wedge, screw
      // type="material":       domino, ball, toyCar, string, cup, bucket, tube,
      //                        box, cardboard, tape, magnet, track, yardstick,
      //                        protractor, matchboxTrack, custom
      // type="marker":         start, finish  (non-deletable; one of each always present)
      subtype: "lever" | "pulley" | "inclinedPlane" | "wheelAxle" | "wedge" | "screw"
             | "domino" | "ball" | "toyCar" | "string" | "cup" | "bucket" | "tube"
             | "box" | "cardboard" | "tape" | "magnet" | "track" | "yardstick"
             | "protractor" | "matchboxTrack" | "custom"
             | "start" | "finish",
      name: "",       // custom items only: student-given name
      x, y,           // position (cm)
      width, height,  // scaled dimensions (cm)
      subParts: {
        // lever:         { fulcrumOffset: 0.4 }
        // pulley:        { leftCordLength: 80, rightCordLength: 60 }
        // inclinedPlane: { angle: 30 }
        // wheelAxle:     { spinDirection: "cw" | "ccw" }
        // screw:         { spinDirection: "cw" | "ccw", angle: 90 }
        // matchboxTrack: { angle: 0 }
        // all others:    {}
      },
      comment: "",
      commentVisible: false
    }
  ],
  connections: [
    { id, fromId, fromPoint, toId, toPoint }
    // fromPoint / toPoint are attachment point IDs from the identifier table above
  ]
}
```

---

## Out of Scope

- Physics simulation (gravity, momentum, friction)
- Multiplayer / real-time collaboration
- User accounts or login
- Mobile / touch-first design
- Chain reaction animation (P2 future consideration)
- Audio snap feedback (P1 future consideration)
