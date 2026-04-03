# Feature Roadmap

Living document tracking planned and backlogged features across phases.
Last updated: 2026-04-02

---

## Phase 1 — Zoom, Pan & Canvas Standardization

**Status:** Brainstorming complete, spec in progress

### Goals
- Give students a proper canvas zoom/pan experience without hijacking the browser window
- Standardize the canvas world size so all students get a consistent design area regardless of screen size or window dimensions

### Design Decisions
- **Pinch gesture** → zoom canvas only (intercept `wheel` event on SVG, call `preventDefault` to block browser zoom)
- **Two-finger scroll** → pan canvas
- Left panel, right panel, and header are completely unaffected by zoom/pan
- Canvas world size fixed, designed around 13" MacBook Air default viewport
- Floor line lives in canvas-world space — zooms and pans with content, may scroll off-screen when zoomed in (intentional)
- Start and finish markers are draggable, positioned within the default viewport on load
- Default view (zoom=1, pan=0,0) shows the full intended workspace

---

## Phase 2 — Connector UX Overhaul

**Status:** Queued

### Goals
- Make energy connections easier to create and understand
- Students currently find "linking steps" difficult

### Tentative Scope
- Drag pulley ends / string ends directly onto a component's attachment point to create a connection
- Teal X repositioning: appear at the point of connection (not offset); for manually-added connectors, teal X in the middle of the connector line
- May also address general connector discoverability

---

## Phase 3 — Component Additions & Enhancements

**Status:** Backlog — not yet designed

### New Components (prioritized by student demand)
- Person/hand (2 requests — "show someone pushing or dropping the first element")
- Funnel (2 requests)
- Rubik's cube (2 requests)
- Spring
- Wall (environmental)
- Catapult
- Fan
- Dump truck
- Train

### Component Behavior Changes
- Color customization for existing components (bucket, car, stairs, bookshelf, chair) — most-requested feature overall
- Resize more items freely (furniture, car ramp length without proportional scaling)
- Free rotation to any angle (not just preset degrees)

---

## Deferred / Out of Scope

- Physics simulation — explicitly out of scope per PRD
- Snake, lacrosse stick, water planter, needoh ball — novelty items, low instructional value
- Simulation lab — out of scope
