# Multi-Select Expand + Copy/Paste Design Spec

## Goal

Extend multi-select to include environment items and step-flag markers, and add Cmd+C / Cmd+V copy/paste for selected items.

---

## Section 1: Expand Multi-Select Scope

### What changes

Currently `getComponentsInRect` filters to `simple_machine | material` only, and the shift-click guard in `drag.js` excludes `environment` and `marker` types. This section removes those exclusions so all item types (env items, markers, machines, materials) participate in multi-select.

### Rubber-band selection

`getComponentsInRect(components, environment, rect)` — updated signature. Returns IDs from **both** arrays. Includes items of any type (environment, marker, simple_machine, material). Start/finish markers are now selectable; the existing delete guard in `main.js` already protects them from deletion.

### Shift-click

Remove the `item.type === 'environment' || item.type === 'marker'` guard in `drag.js`. Any item can now be shift-clicked into the selection.

### Group drag

The group drag loop in `drag.js` currently does `state.components.find(c => c.id === sid)`. Update to check both `state.components` and `state.environment` so env items move with the group.

### Multi-select delete (`js/main.js`)

Currently calls `removeComponent(id)` unconditionally. Update to check which array the ID belongs to:
- `state.components.find(c => c.id === id)` → `removeComponent(id)`
- `state.environment.find(e => e.id === id)` → `removeEnvItem(id)`
- Skip items with `subtype === 'start'` or `subtype === 'finish'` (existing guard, unchanged)

### Files changed

| File | Change |
|---|---|
| `js/multi-select.js` | Add `environment` param; include env items and markers in results |
| `js/test/multi-select.test.js` | Update tests for new signature; add env-item-included and marker-included cases |
| `js/drag.js` | Remove shift-click type guard; update group drag lookup; update rubber-band call |
| `js/main.js` | Update multi-delete to call correct removal function per item type |

---

## Section 2: Copy/Paste (Cmd+C / Cmd+V)

### Clipboard state

A module-level variable added to `js/drag.js`:

```js
let clipboard = null;
// { items: Array<{data, isEnv}>, connections: Array<conn> } or null
// pasteOffset tracks how many times the current clipboard has been pasted (for stacking)
let pasteOffset = 0;
```

`clipboard.items` holds deep copies of the selected items' data (without `id`). Each entry includes `isEnv: boolean` to know which add function to call on paste.

### Cmd+C — `copySelection()`

Exported from `js/drag.js`, called from `main.js` on `e.metaKey && e.key === 'c'`.

1. Get current `selectedIds`. If empty, do nothing.
2. For each ID, find item in `state.components` or `state.environment`.
3. Skip items with `subtype === 'start'` or `'finish'`.
4. Deep-copy the item's data fields (all fields except `id`). Record `isEnv`.
5. Build a `Set` of the copied IDs.
6. From `state.connections`, copy any connection where **both** `fromId` and `toId` are in the set.
7. Store `clipboard = { items, connections }`. Reset `pasteOffset = 0`.

### Cmd+V — `pasteSelection()`

Exported from `js/drag.js`, called from `main.js` on `e.metaKey && e.key === 'v'`.

1. If `clipboard` is null, do nothing.
2. Call `undoPush()`.
3. Increment `pasteOffset`. Offset amount: `pasteOffset * 2` cm in both x and y.
4. Build `oldId → newId` map: for each item in `clipboard.items`, call `addComponent` or `addEnvItem` with a deep copy of the data + offset applied to `x` and `y`. For string components (`subtype === 'string'`), also offset `subParts.x1`, `subParts.y1`, `subParts.x2`, `subParts.y2` by the same delta. Collect the returned new IDs.
5. For each connection in `clipboard.connections`, call `addConnection({ fromId: newIdMap[conn.fromId], fromPoint: conn.fromPoint, toId: newIdMap[conn.toId], toPoint: conn.toPoint })`.
6. Set `selectedIds` to the array of new IDs so the paste lands selected.
7. Call `render()`, `updateTrackerUI()`, `updateUndoButtons()`.

### Paste offset stacking

Each Cmd+V without an intervening Cmd+C increments `pasteOffset` by 1, shifting the paste +2cm further. On a new Cmd+C, `pasteOffset` resets to 0 so the first paste is always +2cm from the original.

### What is NOT copied

- Start and finish markers (skipped during `copySelection`)
- Connections that cross the selection boundary (one endpoint outside the copied set)

### Files changed

| File | Change |
|---|---|
| `js/drag.js` | Add `clipboard`, `pasteOffset` state; add `copySelection()`, `pasteSelection()` exports |
| `js/main.js` | Add `keydown` handlers for Cmd+C and Cmd+V; import `copySelection`, `pasteSelection` |

No new files. No changes to `js/state.js`, `js/render/ui.js`, `style.css`, or `index.html` (version bump aside).

---

## Out of Scope

- Windows Ctrl+C / Ctrl+V (Mac only for now)
- Copy/paste across browser tabs or sessions
- Copying energy link connections that cross the selection boundary
- Undo of paste (paste calls `undoPush()` so it is undoable via existing undo)
