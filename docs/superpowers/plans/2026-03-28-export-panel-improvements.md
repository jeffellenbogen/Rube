# Export Panel Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the exported PNG panel readable when printed by increasing all text sizes, replacing the simple machines count list with a full checkbox checklist, and adding a mode-aware label to the STEPS heading.

**Architecture:** All changes are self-contained in the `downloadPNG()` function in `js/export.js`. No new files, no new tests (canvas draw output is not unit-testable; the existing `encodeITXt`/`decodeITXt` tests are unaffected). Visual verification is done by downloading a test PNG from the running app.

**Tech Stack:** Vanilla JS, Canvas 2D API, ES modules. No build step — open `index.html` directly in Chrome.

---

## File Structure

**Only file modified:** `js/export.js`

Relevant sections of `downloadPNG()` (line numbers are approximate — read the file before editing):
- ~L97: size constants and BOM computation
- ~L127: `mono` helper
- ~L193: panel title "MATERIALS USED"
- ~L205: `panelSection()` helper function
- ~L240: `const req = getRequirements(state)`
- ~L242: `panelSection('SIMPLE MACHINES', bom.machines)`
- ~L243: `panelSection('MATERIALS', bom.materials)`
- ~L246–260: STEPS section
- ~L284: comment bubble constants (`BOX_W`, `FONT_SIZE`, `LINE_H`)

---

## Task 1: Update export panel — text sizes, machine checklist, mode-aware steps

**Files:**
- Modify: `js/export.js`

There are no unit tests to write for canvas rendering. Verification is visual: download a PNG from the running app and check readability.

---

- [ ] **Step 1: Add size constants at the top of `downloadPNG()`**

Open `js/export.js`. Find the line `const mono = size => ...` (around line 127). Directly above it, add:

```js
const ITEM_SIZE = 17;
const HEADER_SIZE = 16;
const PANEL_TITLE_SIZE = 20;
const ROW_H = 20;
const SECTION_GAP = 14;
const HEADER_SPACING = 18;
```

---

- [ ] **Step 2: Simplify the BOM computation to exclude machines**

Find the `const bom = (() => { ... })();` block (around line 104). Replace it entirely:

```js
const bom = (() => {
  const materials = {};
  for (const c of state.components) {
    if (c.type === 'marker') continue;
    if (MACHINE_SUBTYPES.has(c.subtype)) continue; // shown in checklist instead
    const label = ITEM_LABELS[c.subtype] || (c.name || c.subtype);
    materials[label] = (materials[label] || 0) + 1;
  }
  return Object.entries(materials)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
})();
```

---

- [ ] **Step 3: Update the panel title "MATERIALS USED"**

Find the `// Panel title` comment block. Replace it:

```js
// Panel title
ctx.font = mono(PANEL_TITLE_SIZE);
ctx.fillStyle = '#0d1f35';
ctx.textAlign = 'left';
ctx.textBaseline = 'top';
ctx.fillText('MATERIALS USED', panelX + PAD, pY);
pY += 6;
ctx.strokeStyle = '#0d1f35';
ctx.lineWidth = 1.5;
ctx.beginPath(); ctx.moveTo(panelX + PAD, pY + 12); ctx.lineTo(panelX + PANEL_W - PAD, pY + 12); ctx.stroke();
pY += 22;
```

---

- [ ] **Step 4: Update `panelSection()` to use new sizes**

Find the `function panelSection(title, items) {` block. Replace it entirely:

```js
function panelSection(title, items) {
  ctx.font = `bold ${HEADER_SIZE}px "Courier New", Courier, monospace`;
  ctx.fillStyle = '#4a7a9a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(title, panelX + PAD, pY);
  pY += 4;
  ctx.strokeStyle = '#c0d4e8';
  ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.moveTo(panelX + PAD, pY + 12); ctx.lineTo(panelX + PANEL_W - PAD, pY + 12); ctx.stroke();
  pY += HEADER_SPACING;

  if (items.length === 0) {
    ctx.font = `${ITEM_SIZE}px "Courier New", Courier, monospace`;
    ctx.fillStyle = '#aaaaaa';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('none added', panelX + PAD + 4, pY);
    pY += ROW_H;
  } else {
    for (const { name, count } of items) {
      ctx.font = `${ITEM_SIZE}px "Courier New", Courier, monospace`;
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#4a7a9a';
      ctx.textAlign = 'right';
      ctx.fillText(`${count}×`, COUNT_COL, pY);
      ctx.fillStyle = '#1a1a3a';
      ctx.textAlign = 'left';
      ctx.fillText(name, panelX + PAD + 4, pY);
      pY += ROW_H;
    }
  }
  pY += SECTION_GAP;
}
```

---

- [ ] **Step 5: Replace the SIMPLE MACHINES section with a checkbox checklist**

Find the line `panelSection('SIMPLE MACHINES', bom.machines);` and replace it with:

```js
// Simple machines checkbox checklist
const ALL_MACHINES = [
  { sub: 'lever',         label: 'Lever' },
  { sub: 'pulley',        label: 'Pulley' },
  { sub: 'inclinedPlane', label: 'Inclined Plane' },
  { sub: 'wheelAxle',     label: 'Wheel & Axle' },
  { sub: 'wedge',         label: 'Wedge' },
  { sub: 'screw',         label: 'Screw' },
];

ctx.font = `bold ${HEADER_SIZE}px "Courier New", Courier, monospace`;
ctx.fillStyle = '#4a7a9a';
ctx.textAlign = 'left';
ctx.textBaseline = 'top';
ctx.fillText('SIMPLE MACHINES', panelX + PAD, pY);
pY += 4;
ctx.strokeStyle = '#c0d4e8';
ctx.lineWidth = 0.5;
ctx.beginPath(); ctx.moveTo(panelX + PAD, pY + 12); ctx.lineTo(panelX + PANEL_W - PAD, pY + 12); ctx.stroke();
pY += HEADER_SPACING;

const BOX_SIZE = 11, BOX_RADIUS = 2;
for (const { sub, label } of ALL_MACHINES) {
  const used = req.machineTypes.includes(sub);
  ctx.beginPath();
  ctx.roundRect(panelX + PAD + 2, pY + 3, BOX_SIZE, BOX_SIZE, BOX_RADIUS);
  ctx.fillStyle = used ? '#00c9a7' : '#ffffff';
  ctx.fill();
  if (!used) {
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.font = `${ITEM_SIZE}px "Courier New", Courier, monospace`;
  ctx.fillStyle = used ? '#1a1a3a' : '#aaaaaa';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, panelX + PAD + 2 + BOX_SIZE + 7, pY);
  pY += ROW_H;
}

ctx.font = `13px "Courier New", Courier, monospace`;
ctx.fillStyle = req.machinesMet ? '#00c9a7' : '#ef476f';
ctx.textAlign = 'left';
ctx.textBaseline = 'top';
ctx.fillText(
  `${req.machineTypes.length} of 3 required${req.machinesMet ? ' \u2713' : ''}`,
  panelX + PAD + 4, pY
);
pY += 20;
pY += SECTION_GAP;
```

---

- [ ] **Step 6: Update the MATERIALS section call**

Find `panelSection('MATERIALS', bom.materials);` and change it to:

```js
panelSection('MATERIALS', bom);
```

(`bom` is now already just the materials array — machines were removed in Step 2.)

---

- [ ] **Step 7: Replace the STEPS section with a mode-aware heading**

Find the `// Steps counter` comment block (from `ctx.font = \`bold 10px...` through `pY += 15`). Replace it entirely:

```js
// Steps counter
const mode = state.mode || 'auto';
const stepsHeading = mode === 'flags' ? 'STEPS (FLAGS)' : 'STEPS (AUTO)';
const stepsHeadingColor = mode === 'flags' ? '#ef476f' : '#00c9a7';

ctx.font = `bold ${HEADER_SIZE}px "Courier New", Courier, monospace`;
ctx.fillStyle = stepsHeadingColor;
ctx.textAlign = 'left';
ctx.textBaseline = 'top';
ctx.fillText(stepsHeading, panelX + PAD, pY);
pY += 4;
ctx.strokeStyle = '#c0d4e8';
ctx.lineWidth = 0.5;
ctx.beginPath(); ctx.moveTo(panelX + PAD, pY + 12); ctx.lineTo(panelX + PANEL_W - PAD, pY + 12); ctx.stroke();
pY += HEADER_SPACING;
ctx.font = `${ITEM_SIZE}px "Courier New", Courier, monospace`;
ctx.fillStyle = req.stepsMet ? '#00c9a7' : '#1a1a3a';
ctx.textAlign = 'left';
ctx.textBaseline = 'top';
ctx.fillText(`${req.steps} of 5+${req.stepsMet ? ' \u2713' : ''}`, panelX + PAD + 4, pY);
pY += ROW_H;
```

---

- [ ] **Step 8: Increase comment bubble font size**

Find the line:
```js
const BOX_W = 130, BOX_PAD = 6, FONT_SIZE = 9, LINE_H = FONT_SIZE + 3;
```

Replace it with:
```js
const BOX_W = 130, BOX_PAD = 6, FONT_SIZE = 13, LINE_H = 17;
```

---

- [ ] **Step 9: Verify visually**

1. Open `index.html` in Chrome (drag-drop or `open index.html`)
2. Add a few components — at least 2 simple machines and 2 materials, one with a comment bubble visible
3. Click **Download**
4. Open the downloaded PNG and check:
   - Panel text is clearly readable without zooming
   - SIMPLE MACHINES shows all 6 with ■ for placed, □ for not placed, and "N of 3 required" summary
   - MATERIALS shows only non-machine items with counts
   - STEPS heading shows "STEPS (AUTO)" in teal (or "STEPS (FLAGS)" in red if toggled)
   - Comment bubble text is clearly readable
5. Toggle to FLAGS mode (flip the AUTO/FLAGS switch in the sidebar), place 3 flags, download again and verify "STEPS (FLAGS)" appears in red

---

- [ ] **Step 10: Bump version and commit**

In `index.html`, find `<div id="version-label">v2.5.33</div>` and change it to `v2.5.34`.

```bash
git add js/export.js index.html
git commit -m "feat: larger export text, machine checklist, mode-aware steps label (v2.5.34)"
```

---

## Self-Review

**Spec coverage:**
- ✓ Text size increased (Steps 1, 3, 4, 8)
- ✓ Comment bubbles larger (Step 8)
- ✓ Simple machines checklist with ■/□ (Step 5)
- ✓ "N of 3 required" summary (Step 5)
- ✓ STEPS (AUTO) / STEPS (FLAGS) mode-aware heading (Step 7)
- ✓ MATERIALS section no longer lists machines (Step 2 + 6)

**Placeholder scan:** No TBDs. All code is complete.

**Consistency check:** `ITEM_SIZE`, `HEADER_SIZE`, `ROW_H`, `SECTION_GAP`, `HEADER_SPACING` are defined once (Step 1) and used throughout (Steps 3, 4, 5, 7). `BOX_SIZE` and `BOX_RADIUS` are defined once in Step 5 where they are used. `bom` is redefined in Step 2 and consumed in Step 6 as a flat array — consistent. `req.machineTypes`, `req.machinesMet`, `req.steps`, `req.stepsMet` are all returned by `getRequirements(state)` which is already called at line 240 before all panel drawing — consistent.
