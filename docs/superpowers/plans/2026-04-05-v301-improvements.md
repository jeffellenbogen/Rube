# v3.0.1 Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four polish improvements: fix BOM sort order on screen, expand the PNG materials panel to full page height with overflow clipping, embed the current app version in PNG metadata and printout, and add rotate/reflect controls for chair and desk environment items.

**Architecture:** All changes are isolated to existing files — no new modules. The BOM sort fix is a one-line tracker.js change with a test. The PNG export changes are self-contained in export.js. The chair/desk controls follow the identical pattern used for `bookshelf` in ui.js. The flip+rotation transform fix in environment.js uses a unified SVG transform string.

**Tech Stack:** Vanilla JS ES modules, SVG, HTML Canvas 2D API. Tests run with `node --experimental-vm-modules js/test/<file>.test.js`.

---

## File Map

| File | Change |
|------|--------|
| `js/tracker.js` | Add local `ITEM_LABELS` constant; sort BOM by display label |
| `js/test/tracker.test.js` | Add test asserting correct label-based sort order |
| `js/export.js` | Hoist `panelX`/`canvasAreaW` before header; shrink header rules to canvas area; expand panel to full height; add `panelBottom` overflow guard in `panelSection`; write `savedWithVersion` to metadata; render version footer |
| `js/render/ui.js` | Add rotate ↻ + flip ↔ buttons for `chair` and `desk` env items |
| `js/render/environment.js` | Replace 3-branch transform with unified flip+rotation formula |
| `index.html` | Bump version label to `v3.0.1` |

---

## Task 1: Fix BOM sort order on screen

**Files:**
- Modify: `js/tracker.js`
- Modify: `js/test/tracker.test.js`

The on-screen BOM list sorts by subtype key (`matchboxTrack`, `box`) rather than display label (`Car Track`, `Crate`). Add a local `ITEM_LABELS` map and sort by the mapped label.

- [ ] **Step 1: Write the failing test**

  Add this test to `js/test/tracker.test.js` (before the final line):

  ```js
  test('BOM sorts by display label, not subtype key', () => {
    const comps = [
      { type: 'material', subtype: 'matchboxTrack' }, // label: Car Track
      { type: 'material', subtype: 'box' },            // label: Crate
      { type: 'material', subtype: 'ball' },           // label: Ball
    ];
    const bom = getBOM({ components: comps });
    // Ball < Car Track < Crate alphabetically
    assertEqual(bom[0].name, 'ball');
    assertEqual(bom[1].name, 'matchboxTrack');
    assertEqual(bom[2].name, 'box');
  });
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  node --experimental-vm-modules js/test/tracker.test.js
  ```

  Expected: the new test fails — `matchboxTrack` currently sorts before `ball` (m > b by key).

- [ ] **Step 3: Fix tracker.js**

  Replace the entire contents of `js/tracker.js` with:

  ```js
  import { countSteps } from './connections.js';

  const MACHINE_SUBTYPES = ['lever','pulley','inclinedPlane','wheelAxle','wedge','screw'];
  const EXCLUDED_TYPES = ['marker'];
  const MACHINES_REQUIRED = 3;
  const STEPS_REQUIRED = 5;

  const ITEM_LABELS = {
    lever:'Lever', pulley:'Pulley', inclinedPlane:'Inclined Plane',
    wheelAxle:'Wheel & Axle', wedge:'Wedge', screw:'Screw',
    domino:'Domino', ball:'Ball', toyCar:'Toy Car', string:'String',
    cup:'Cup', bucket:'Bucket', tube:'Tube', box:'Crate',
    cardboard:'Cardboard', yardstick:'Yardstick', protractor:'Protractor',
    matchboxTrack:'Car Track', book:'Book',
  };

  export function getRequirements(state) {
    const components = state.components || [];
    const placed = components.filter(c => c.type === 'simple_machine');
    const machineTypes = [...new Set(placed.map(c => c.subtype))];
    const mode = state.mode || 'auto';
    const steps = mode === 'flags'
      ? components.filter(c => c.type === 'marker' && c.subtype === 'flag').length
      : countSteps(state);
    return {
      machineTypes,
      machinesMet: machineTypes.length >= MACHINES_REQUIRED,
      steps,
      stepsMet: steps >= STEPS_REQUIRED,
      allMachines: MACHINE_SUBTYPES
    };
  }

  export function getBOM(state) {
    const counts = {};
    for (const c of state.components) {
      if (EXCLUDED_TYPES.includes(c.type)) continue;
      const name = c.subtype === 'custom' ? (c.name || 'Custom') : c.subtype;
      counts[name] = (counts[name] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        const la = ITEM_LABELS[a.name] || a.name;
        const lb = ITEM_LABELS[b.name] || b.name;
        return la.localeCompare(lb);
      });
  }
  ```

- [ ] **Step 4: Run tests to confirm all pass**

  ```bash
  node --experimental-vm-modules js/test/tracker.test.js
  ```

  Expected: `13 passed, 0 failed`

- [ ] **Step 5: Commit**

  ```bash
  git add js/tracker.js js/test/tracker.test.js
  git commit -m "fix: sort on-screen BOM by display label (v3.0.1)"
  ```

---

## Task 2: PNG panel — full page height + overflow clipping

**Files:**
- Modify: `js/export.js`

The panel currently spans from `mainY` (below the header) to `mainY + mainH` (short of the page bottom). Expanding it to full page height requires hoisting `panelX`/`canvasAreaW` before the header is drawn (so the header rules can stop at the canvas area boundary), then updating the panel border and content start position.

- [ ] **Step 1: Hoist panel geometry before the header block**

  In `js/export.js`, locate this block (around line 123):

  ```js
  // === Page: landscape letter at 300 DPI (11" × 8.5") ===
  // Logical layout coordinates stay at 150 DPI; canvas is 2× for crispness.
  const PAGE_W = 1650, PAGE_H = 1275;
  const MARGIN = 54;
  const HEADER_H = 130;
  const FRAME = MARGIN - 12;
  ```

  Replace it with:

  ```js
  // === Page: landscape letter at 300 DPI (11" × 8.5") ===
  // Logical layout coordinates stay at 150 DPI; canvas is 2× for crispness.
  const PAGE_W = 1650, PAGE_H = 1275;
  const MARGIN = 54;
  const HEADER_H = 130;
  const FRAME = MARGIN - 12;

  // Panel geometry — hoisted here so the header rules can stop at the canvas boundary
  const PANEL_W = 260, PANEL_GAP = 12;
  const panelX = PAGE_W - MARGIN - PANEL_W;
  const canvasAreaW = panelX - MARGIN - PANEL_GAP;
  ```

- [ ] **Step 2: Remove the duplicated panel geometry lines from the MAIN AREA section**

  Locate this block (around line 194):

  ```js
  const mainY = MARGIN + HEADER_H + 10;
  const mainH = PAGE_H - mainY - MARGIN - 10;
  const PANEL_W = 260, PANEL_GAP = 12;
  const panelX = PAGE_W - MARGIN - PANEL_W;
  const canvasAreaW = panelX - MARGIN - PANEL_GAP;
  ```

  Replace it with (removing the three now-duplicate lines):

  ```js
  const mainY = MARGIN + HEADER_H + 10;
  const mainH = PAGE_H - mainY - MARGIN - 10;
  ```

- [ ] **Step 3: Shrink header rules to canvas area width and move date**

  Locate the header top rule:

  ```js
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN, PAGE_W - 2*MARGIN, 4); // top rule
  ```

  Replace with:

  ```js
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN, canvasAreaW, 4); // top rule — canvas area only
  ```

  Locate the date rendering line:

  ```js
  ctx.fillText(dateStr, PAGE_W - MARGIN, MARGIN + 10);
  ```

  Replace with:

  ```js
  ctx.fillText(dateStr, panelX - PANEL_GAP, MARGIN + 10);
  ```

  Locate the header bottom rule:

  ```js
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN + HEADER_H, PAGE_W - 2*MARGIN, 2);
  ```

  Replace with:

  ```js
  ctx.fillStyle = '#0d1f35';
  ctx.fillRect(MARGIN, MARGIN + HEADER_H, canvasAreaW, 2);
  ```

- [ ] **Step 4: Expand the panel border and reset pY to panel top**

  Locate:

  ```js
  // Panel border
  ctx.strokeStyle = '#b0c8e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, mainY, PANEL_W, mainH);

  const PAD = 10;
  const COUNT_COL = panelX + PANEL_W - PAD;
  let pY = mainY + PAD;
  ```

  Replace with:

  ```js
  const panelTop = MARGIN;
  const panelHeight = PAGE_H - 2 * MARGIN;
  // Reserve 20px at the bottom for the version footer line
  const panelBottom = panelTop + panelHeight - PAD - 20;

  // Panel border — full page height
  ctx.strokeStyle = '#b0c8e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelTop, PANEL_W, panelHeight);

  const PAD = 10;
  const COUNT_COL = panelX + PANEL_W - PAD;
  let pY = panelTop + PAD;
  ```

- [ ] **Step 5: Add overflow guard to panelSection**

  Locate the `panelSection` function. Replace the `else` branch (the `for` loop over items) with a version that checks `panelBottom` before each item:

  Find:

  ```js
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
  ```

  Replace with:

  ```js
    } else {
      let drawn = 0;
      for (const { name, count } of items) {
        if (pY + ROW_H > panelBottom) {
          const remaining = items.length - drawn;
          ctx.font = `${ITEM_SIZE - 2}px "Courier New", Courier, monospace`;
          ctx.fillStyle = '#aaaaaa';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(`\u2026and ${remaining} more`, panelX + PAD + 4, pY);
          pY += ROW_H;
          break;
        }
        ctx.font = `${ITEM_SIZE}px "Courier New", Courier, monospace`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#4a7a9a';
        ctx.textAlign = 'right';
        ctx.fillText(`${count}\u00d7`, COUNT_COL, pY);
        ctx.fillStyle = '#1a1a3a';
        ctx.textAlign = 'left';
        ctx.fillText(name, panelX + PAD + 4, pY);
        pY += ROW_H;
        drawn++;
      }
    }
  ```

- [ ] **Step 6: Verify in browser**

  Open `index.html` locally. Add 10+ materials to the canvas, then click Download. Open the PNG — the right panel should now span the full page height, and all materials should be visible (or show `…and X more` if still overflowing).

- [ ] **Step 7: Commit**

  ```bash
  git add js/export.js
  git commit -m "fix: expand PNG materials panel to full page height with overflow clipping (v3.0.1)"
  ```

---

## Task 3: Embed app version in PNG metadata and printout

**Files:**
- Modify: `js/export.js`

On download, read the version string from the DOM, write it to `exportState.meta.savedWithVersion`, and render a small `Saved with vX.X.X` line at the bottom of the right panel.

- [ ] **Step 1: Add version to exportState**

  Locate:

  ```js
  const exportState = { ...state, meta: { ...state.meta, floorY: FLOOR_Y } };
  ```

  Replace with:

  ```js
  const versionEl = document.getElementById('version-label');
  const savedWithVersion = versionEl ? versionEl.textContent.trim() : '';
  const exportState = { ...state, meta: { ...state.meta, floorY: FLOOR_Y, savedWithVersion } };
  ```

- [ ] **Step 2: Render version footer at bottom of panel**

  Locate:

  ```js
  pY += ROW_H;

  // ── SVG CANVAS ───────────────────────────────────────────────────────────
  ```

  (This is the line after the steps `fillText` call, just before the SVG canvas section.)

  Insert the version footer immediately after `pY += ROW_H;` and before the SVG canvas comment:

  ```js
  // Version footer — bottom of right panel
  if (savedWithVersion) {
    ctx.font = `11px "Courier New", Courier, monospace`;
    ctx.fillStyle = '#4a7a9a';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`Saved with ${savedWithVersion}`, panelX + PANEL_W - PAD, panelTop + panelHeight - PAD);
  }
  ```

- [ ] **Step 3: Verify in browser**

  Download a PNG. The bottom of the right panel should show `Saved with v3.0.1` (or whatever `#version-label` contains) in muted blue-gray, right-aligned.

- [ ] **Step 4: Commit**

  ```bash
  git add js/export.js
  git commit -m "feat: embed app version in PNG metadata and printout footer (v3.0.1)"
  ```

---

## Task 4: Rotate and flip buttons for chair and desk

**Files:**
- Modify: `js/render/ui.js`

The existing `action="rotate"` and `action="flip"` handlers in `main.js` already support env items — they just need UI buttons. Follow the identical pattern used for `bookshelf` (which gets a rotate-only button), but also add the flip button.

- [ ] **Step 1: Add the rotate + flip block for chair and desk**

  In `js/render/ui.js`, locate the bookshelf block:

  ```js
  // Rotate-only button for bookshelf (env item)
  const isBookshelf = !!state.environment.find(e => e.id === selId && e.subtype === 'bookshelf');
  if (isBookshelf) {
  ```

  Insert the following block **immediately before** the `// Rotate-only button for bookshelf` comment:

  ```js
  // Rotate + Flip buttons for chair and desk (env items)
  const isChairOrDesk = !!state.environment.find(e => e.id === selId && (e.subtype === 'chair' || e.subtype === 'desk'));
  if (isChairOrDesk) {
    const rotPos = L(w2 + pad + 8, h2 + pad + 8);
    const rotBtn = document.createElementNS(NS, 'g');
    rotBtn.dataset.action = 'rotate'; rotBtn.dataset.targetId = selId;
    rotBtn.setAttribute('cursor', 'pointer');
    const rbg = document.createElementNS(NS, 'circle');
    rbg.setAttribute('cx', rotPos.x); rbg.setAttribute('cy', rotPos.y);
    rbg.setAttribute('r', 8); rbg.setAttribute('fill', '#1a3a5c');
    rbg.setAttribute('stroke', '#ff7b2e'); rbg.setAttribute('stroke-width', 1);
    const rt = document.createElementNS(NS, 'text');
    rt.setAttribute('x', rotPos.x); rt.setAttribute('y', rotPos.y);
    rt.setAttribute('text-anchor', 'middle'); rt.setAttribute('dominant-baseline', 'middle');
    rt.setAttribute('fill', '#fff'); rt.setAttribute('font-size', 11); rt.textContent = '↻';
    rotBtn.appendChild(rbg); rotBtn.appendChild(rt);
    layer.appendChild(rotBtn);

    const flipPos = L(-w2 - pad - 8, h2 + pad + 8);
    const flipBtn = document.createElementNS(NS, 'g');
    flipBtn.dataset.action = 'flip'; flipBtn.dataset.targetId = selId;
    flipBtn.setAttribute('cursor', 'pointer');
    const fbg = document.createElementNS(NS, 'circle');
    fbg.setAttribute('cx', flipPos.x); fbg.setAttribute('cy', flipPos.y);
    fbg.setAttribute('r', 8); fbg.setAttribute('fill', '#1a3a5c');
    fbg.setAttribute('stroke', '#ff7b2e'); fbg.setAttribute('stroke-width', 1);
    const ft = document.createElementNS(NS, 'text');
    ft.setAttribute('x', flipPos.x); ft.setAttribute('y', flipPos.y);
    ft.setAttribute('text-anchor', 'middle'); ft.setAttribute('dominant-baseline', 'middle');
    ft.setAttribute('fill', '#fff'); ft.setAttribute('font-size', 11); ft.textContent = '↔';
    flipBtn.appendChild(fbg); flipBtn.appendChild(ft);
    layer.appendChild(flipBtn);
  }
  ```

- [ ] **Step 2: Verify in browser**

  Open `index.html`. Drag a Chair onto the canvas and click it. Orange ↻ and ↔ buttons should appear at bottom-right and bottom-left. Click ↻ — the chair should rotate 90°. Click ↔ — the chair should mirror horizontally. Do the same for a Desk.

- [ ] **Step 3: Commit**

  ```bash
  git add js/render/ui.js
  git commit -m "feat: add rotate and flip buttons for chair and desk env items (v3.0.1)"
  ```

---

## Task 5: Fix combined flip + rotation transform

**Files:**
- Modify: `js/render/environment.js`

Currently, if an env item has both `flipped: true` and a non-zero `rotation`, only the rotation is applied (the flip is silently dropped). Replace the 3-branch conditional with a unified SVG transform that correctly composes both.

The transform `translate(cx,cy) rotate(deg) scale(flipX,1) translate(-cx,-cy)` is equivalent to the existing pure-flip and pure-rotation behaviors when only one is active, and correctly combines both when both are set.

- [ ] **Step 1: Replace the transform block in makeEnvItem**

  In `js/render/environment.js`, locate:

  ```js
  const cx = x + w / 2, cy = y + h / 2;
  const rotation = item.rotation || 0;
  if (item.flipped && !rotation) {
    g.setAttribute('transform', `translate(${cx},0) scale(-1,1) translate(${-cx},0)`);
  } else if (rotation) {
    g.setAttribute('transform', `rotate(${rotation},${cx},${cy})`);
  }
  ```

  Replace with:

  ```js
  const cx = x + w / 2, cy = y + h / 2;
  const rotation = item.rotation || 0;
  const flipX = item.flipped ? -1 : 1;
  if (item.flipped || rotation) {
    g.setAttribute('transform',
      `translate(${cx},${cy}) rotate(${rotation}) scale(${flipX},1) translate(${-cx},${-cy})`);
  }
  ```

- [ ] **Step 2: Verify in browser**

  1. Drag a Chair onto the canvas. Click it. Press ↔ to flip. The chair should mirror horizontally.
  2. Press ↻ to rotate 90°. The chair should be both rotated and flipped (not just rotated with flip dropped).
  3. Press ↔ again. The flip should toggle back while rotation stays.
  4. Repeat with a Desk. Confirm bookshelf and couch still look correct (no visible regression).

- [ ] **Step 3: Commit**

  ```bash
  git add js/render/environment.js
  git commit -m "fix: apply both flip and rotation transforms on env items (v3.0.1)"
  ```

---

## Task 6: Version bump and final commit

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Bump version label**

  In `index.html`, locate:

  ```html
  <div id="version-label">v3.0.0</div>
  ```

  Replace with:

  ```html
  <div id="version-label">v3.0.1</div>
  ```

- [ ] **Step 2: Run the full test suite**

  ```bash
  node --experimental-vm-modules js/test/tracker.test.js
  ```

  Expected: `13 passed, 0 failed`

- [ ] **Step 3: Commit**

  ```bash
  git add index.html
  git commit -m "chore: bump to v3.0.1"
  ```

- [ ] **Step 4: Push to New-Features**

  ```bash
  git push origin New-Features
  ```

  Then hard-refresh the GitHub Pages preview to verify the version label reads `v3.0.1`.
