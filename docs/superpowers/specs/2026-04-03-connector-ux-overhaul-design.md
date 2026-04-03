# Phase 2: Connector UX Overhaul — Design Spec

Date: 2026-04-03
Status: Approved
Version target: v2.7.0

---

## Problem

The current delete affordance for connections is confusing:
- The teal × floats 12px above one endpoint — hard to find, easy to misidentify
- Connections cannot be selected, so students can't bulk-delete or copy groups that include their links
- No visual feedback when hovering or clicking a connection line

---

## Two Connection Categories

### Physical Connections
Snap (ball landing on lever) and cord (pulley/string end anchored to a component). These have a real visual representation — the cord or the direct contact — so the × belongs **at the point of contact**.

### Symbolic Connections
The orange arrow lines connecting things like START → car, domino → lever, etc. These represent "this triggers that" with no physical string. The × belongs **at the midpoint of the orange line**, visible only when that connection is selected.

---

## Behavior Spec

### Physical connections (snap + cord)
- Teal × renders **at the attachment point** where the two components touch
  - Snap: at `p1` (the snap attachment point on the machine)
  - Cord: at `p2` (the cord endpoint on the other component)
- × is visible only when **either connected component is in `selectedIds`**
- Clicking × calls `removeConnection` as today

### Symbolic connections (orange lines)
- The orange line has a **clickable hit area** (~8px radius from the line)
- Clicking the line **adds the connection ID to `selectedIds`** (deselects any single-selected component; works alongside multi-select)
- When selected, the line renders **thicker and brighter** (highlighted stroke)
- Teal × renders at the **geometric midpoint** of the line when the connection is in `selectedIds`
- Clicking × calls `removeConnection` and removes the ID from `selectedIds`
- Pressing Delete/Backspace removes all connection IDs in `selectedIds`

### Rubber-band selection
- When the rubber-band rect is released, symbolic connections are added to `selectedIds` when **both endpoint components** are inside the rect
- Physical connections (snap/cord) are not added to `selectedIds` via rubber-band — their × appears when either endpoint is selected

### Multi-select operations
- **Delete**: connection IDs in `selectedIds` are removed via `removeConnection`
- **Copy/paste**: connections whose both endpoints are in `selectedIds` are included in the clipboard (this already works; explicitly-selected connection IDs reinforce inclusion)
- **Drag**: connection IDs in `selectedIds` are ignored during group drag (connections follow their endpoint components naturally)
- **Escape**: clears all selections including connection IDs

---

## Architecture

### Selection model: unified `selectedIds` (Approach A)
Connection IDs join the existing `selectedIds[]` in `drag.js` alongside component and env IDs. Operations that don't apply to connections (drag) guard by checking if the ID belongs to a connection.

### File changes

| File | Change |
|------|--------|
| `js/multi-select.js` | Add `connections` param; return connection IDs where both endpoints are in rect |
| `js/test/multi-select.test.js` | Update to 4-arg signature; add connection rubber-band tests |
| `js/drag.js` | Click detection on orange lines; rubber-band passes connections array; group drag skips conn IDs; copy/paste handles conn IDs; Escape clears conn IDs |
| `js/render/connections.js` | × at midpoint for selected orange lines; × at contact point for snap/cord when endpoint selected; highlight selected lines |
| `js/main.js` | Delete handler routes connection IDs to `removeConnection`; import `removeConnection` |
| `index.html` | Version bump to v2.7.0 |

---

## Visual Details

- Selected orange line: stroke `#ff9f5e` (lighter orange), stroke-width 3 (up from 2)
- Teal × circle at midpoint: same style as current (r=7, fill `#00c9a7`, white ×)
- Physical × at contact point: same teal circle style, no offset from the attachment point
- Hit area for line click: transparent stroke-width ~16px on the line element
