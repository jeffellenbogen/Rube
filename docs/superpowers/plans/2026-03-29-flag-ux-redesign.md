# Flag UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Step Flag out of the Materials library into the right panel, replace the flip-switch mode toggle with labeled mode cards, and add a draggable flag widget shown only in FLAGS mode.

**Architecture:** Four files touch: `index.html` (DOM structure), `style.css` (flip-switch styles removed, mode-card + widget styles added), `js/tracker-ui.js` (active card + widget show/hide + widget number), `js/main.js` (remove flag from CATALOG, retarget mode click handler). The existing library `dragstart` handler covers the new drag widget with zero new drag code — the widget uses the same `class="lib-item"` + `data-*` attributes the library does.

**Tech Stack:** Vanilla JS ES modules, inline SVG, no build step. Chrome/Chromebook target.

---

## File Map

| File | Change |
|---|---|
| `index.html` | Replace `#step-mode-header` block with `<h3>Steps</h3>` + `#step-mode-cards` + `#flag-drag-widget`; version bump |
| `style.css` | Remove 45-line flip-switch block (lines 590–634); add `.mode-card`, `#step-mode-cards`, `#flag-drag-widget` styles |
| `js/tracker-ui.js` | Replace flip-switch DOM updates with mode-card active class + widget show/hide + widget flag number |
| `js/main.js` | Remove `flag` entry from `CATALOG.materials`; retarget `#mode-switch` click handler to `.mode-card[data-mode]` |

`js/drag.js`, `js/render/materials.js`, `js/tracker.js`, `js/state.js` — **no changes needed**.

---

### Task 1: Replace DOM in `index.html`

**Files:**
- Modify: `index.html:51-64` (the `<aside id="tracker">` block)

Current DOM (lines 51–64):
```html
<aside id="tracker">
  <h3>Requirements</h3>
  <ul id="machine-checklist"></ul>
  <div id="step-mode-header">
    <span class="mode-label" id="mode-auto-label">AUTO</span>
    <button id="mode-switch" role="switch" aria-checked="false" aria-label="Toggle step counting mode"></button>
    <span class="mode-label" id="mode-flags-label">FLAGS</span>
  </div>
  <div id="step-counter"></div>
  <h3>Bill of Materials</h3>
  <ul id="bom-list"></ul>
  ...
```

- [ ] **Step 1: Replace `#step-mode-header` block with new Steps section**

  Open `index.html`. Find and replace the `<div id="step-mode-header">...</div>` block (the three lines containing `mode-auto-label`, `mode-switch`, `mode-flags-label`). Replace those three lines with:

  ```html
      <h3>Steps</h3>
      <div id="step-mode-cards">
        <button class="mode-card" id="mode-card-auto" data-mode="auto">
          <span class="mode-card-title">AUTO</span>
          <span class="mode-card-desc">Counts connections</span>
        </button>
        <button class="mode-card" id="mode-card-flags" data-mode="flags">
          <span class="mode-card-title">FLAGS</span>
          <span class="mode-card-desc">You mark steps</span>
        </button>
      </div>
  ```

  And add the flag drag widget immediately after `<div id="step-counter"></div>`:

  ```html
      <div id="flag-drag-widget" class="lib-item" draggable="true"
           data-subtype="flag" data-type="marker"
           data-default-w="8" data-default-h="24" hidden>
        <svg width="20" height="36" viewBox="0 0 8 24" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
          <rect x="1" y="0" width="6" height="9" rx="1" fill="#ef476f"/>
          <text id="flag-widget-number" x="4" y="7" text-anchor="middle" font-size="5" fill="white" font-family="monospace" font-weight="bold">1</text>
          <line x1="4" y1="9" x2="4" y2="22" stroke="#4a7a9a" stroke-width="1.5"/>
          <circle cx="4" cy="22" r="2" fill="#4a7a9a"/>
        </svg>
        <div>
          <span class="flag-widget-label">STEP FLAG</span>
          <span class="flag-widget-sub">Drag to canvas</span>
        </div>
      </div>
  ```

  Also bump the version in `#version-label` from `v2.5.35` to `v2.5.36`.

- [ ] **Step 2: Verify HTML structure in browser**

  Open `index.html` directly in Chrome (file://). Confirm:
  - Right panel shows "Steps" header matching "Requirements" and "Bill of Materials" headers in style
  - Two side-by-side cards are visible (we'll style them in Task 2)
  - Step counter still renders
  - No JS errors in console

- [ ] **Step 3: Commit**

  ```bash
  git add index.html
  git commit -m "feat: replace flip-switch with mode-card DOM structure (v2.5.36)"
  ```

---

### Task 2: Remove flip-switch styles, add mode-card + widget styles in `style.css`

**Files:**
- Modify: `style.css:590-634` (flip-switch block) + append new rules

- [ ] **Step 1: Remove the flip-switch CSS block**

  Delete lines 590–634 in `style.css`. The block to remove is:

  ```css
  #step-mode-header {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    margin-bottom: 2px;
  }
  .mode-label {
    font-size: 9px;
    font-family: var(--font-main);
    letter-spacing: 0.5px;
    color: var(--text-dim);
    transition: color 0.2s;
  }
  .mode-label.active { color: var(--red); }
  #mode-auto-label.active { color: var(--teal); }
  #mode-switch {
    position: relative;
    width: 28px;
    height: 15px;
    background: var(--border);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    padding: 0;
    transition: background 0.2s;
    flex-shrink: 0;
  }
  #mode-switch::after {
    content: '';
    position: absolute;
    left: 2px;
    top: 2px;
    width: 11px;
    height: 11px;
    background: white;
    border-radius: 50%;
    transition: transform 0.2s;
  }
  #mode-switch.flags-active {
    background: var(--red);
  }
  #mode-switch.flags-active::after {
    transform: translateX(13px);
  }
  ```

- [ ] **Step 2: Add mode-card and flag widget styles**

  Append the following CSS after the `#welcome-help:hover` rule (at the end of the welcome section, around line 589 after the deletion):

  ```css
  #step-mode-cards {
    display: flex;
    gap: 5px;
    margin-bottom: 8px;
  }
  .mode-card {
    flex: 1;
    padding: 5px 6px;
    background: var(--panel-bg);
    border: 1px solid var(--border);
    border-radius: 3px;
    cursor: pointer;
    text-align: left;
    opacity: 0.5;
  }
  .mode-card-title {
    display: block;
    font-size: 9px;
    font-family: var(--font-main);
    font-weight: bold;
    letter-spacing: 0.5px;
    color: var(--text-dim);
  }
  .mode-card-desc {
    display: block;
    font-size: 7px;
    color: var(--text-dim);
    margin-top: 2px;
    line-height: 1.3;
  }
  .mode-card.active {
    border-width: 1.5px;
    opacity: 1;
  }
  #mode-card-auto.active {
    border-color: var(--teal);
    background: #0d1f35;
  }
  #mode-card-auto.active .mode-card-title { color: var(--teal); }
  #mode-card-flags.active {
    border-color: var(--red);
    background: #1a0a1c;
  }
  #mode-card-flags.active .mode-card-title { color: var(--red); }

  #flag-drag-widget {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    background: #110818;
    border: 1.5px dashed var(--red);
    border-radius: 4px;
    cursor: grab;
    margin-top: 4px;
  }
  .flag-widget-label {
    display: block;
    font-size: 9px;
    font-family: var(--font-main);
    font-weight: bold;
    letter-spacing: 0.5px;
    color: var(--red);
  }
  .flag-widget-sub {
    display: block;
    font-size: 8px;
    color: var(--text-dim);
    margin-top: 1px;
  }
  ```

  **CSS variable reference** (already defined in `:root`):
  - `--teal: #00c9a7`
  - `--red: #ef476f`
  - `--border: #1a3a5c`
  - `--panel-bg: #0a1628`
  - `--text-dim: #4a7a9a`
  - `--font-main` is the Orbitron/monospace stack used for tracker headers

- [ ] **Step 3: Visual check in browser**

  Reload `index.html` in Chrome. Verify:
  - Two mode cards visible, both dim (opacity 0.5) — we'll wire active state in Task 3
  - No flip-switch remnant visible
  - Flag drag widget not visible (it has `hidden` attribute from Task 1 — correct)
  - Steps h3 header visually matches Requirements and Bill of Materials headers

- [ ] **Step 4: Commit**

  ```bash
  git add style.css
  git commit -m "style: replace flip-switch with mode-card and flag-drag-widget styles"
  ```

---

### Task 3: Update `js/tracker-ui.js` — mode cards + widget show/hide + widget number

**Files:**
- Modify: `js/tracker-ui.js`

Current `updateTrackerUI()` DOM updates for the mode toggle (lines 30–38):
```js
const modeSwitch = document.getElementById('mode-switch');
const modeAutoLabel = document.getElementById('mode-auto-label');
const modeFlagsLabel = document.getElementById('mode-flags-label');
if (modeSwitch) {
  modeSwitch.classList.toggle('flags-active', mode === 'flags');
  modeSwitch.setAttribute('aria-checked', String(mode === 'flags'));
}
if (modeAutoLabel) modeAutoLabel.classList.toggle('active', mode === 'auto');
if (modeFlagsLabel) modeFlagsLabel.classList.toggle('active', mode === 'flags');
```

- [ ] **Step 1: Replace the flip-switch DOM block with mode-card + widget logic**

  Replace lines 30–38 (the nine lines from `const modeSwitch` through `modeFlagsLabel`) with:

  ```js
  const cardAuto = document.getElementById('mode-card-auto');
  const cardFlags = document.getElementById('mode-card-flags');
  if (cardAuto) cardAuto.classList.toggle('active', mode === 'auto');
  if (cardFlags) cardFlags.classList.toggle('active', mode === 'flags');

  const widget = document.getElementById('flag-drag-widget');
  if (widget) {
    widget.hidden = mode !== 'flags';
    const flagCount = state.components.filter(c => c.type === 'marker' && c.subtype === 'flag').length;
    const numEl = widget.querySelector('#flag-widget-number');
    if (numEl) numEl.textContent = String(flagCount + 1);
    widget.dataset.catalog = JSON.stringify({ subtype: 'flag', type: 'marker', defaultW: 8, defaultH: 24 });
  }
  ```

  The `widget.dataset.catalog` line sets the same JSON payload the library `dragstart` handler reads (`e.dataTransfer.getData('catalog')`), so the existing canvas drop handler places the flag correctly with zero new drag code.

- [ ] **Step 2: Verify mode cards and widget in browser**

  Open `index.html` in Chrome.
  - Switch to AUTO mode (default): AUTO card should be highlighted teal, FLAGS card dim. Flag widget hidden.
  - Click FLAGS card (once wired in Task 4): FLAGS card should highlight red, AUTO card dim. Flag widget visible showing "1".
  - Place a flag: widget should update to "2" on next render.

  (Task 4 wires the click handler — use browser console to test early: `setState({mode:'flags'}); render();`)

- [ ] **Step 3: Commit**

  ```bash
  git add js/tracker-ui.js
  git commit -m "feat: update tracker-ui for mode cards and flag drag widget"
  ```

---

### Task 4: Update `js/main.js` — remove flag from CATALOG, retarget mode click handler

**Files:**
- Modify: `js/main.js:25-41` (CATALOG.materials) and `js/main.js:351-355` (mode-switch handler)

- [ ] **Step 1: Remove the `flag` entry from `CATALOG.materials`**

  In `CATALOG.materials` (line 26), remove this line:
  ```js
  { subtype: 'flag', label: 'Step Flag', type: 'marker', defaultW: 8, defaultH: 24 },
  ```

  The `flag` case in `makeComponentIcon` (line 84) can remain — it's a lookup by subtype that just becomes unreachable from the library. No harm, but leave it for future reference.

- [ ] **Step 2: Replace the `#mode-switch` click handler**

  Find and replace the entire block at lines 351–355:
  ```js
  document.getElementById('mode-switch').addEventListener('click', () => {
    const current = getState().mode || 'auto';
    setState({ mode: current === 'auto' ? 'flags' : 'auto' });
    render();
  });
  ```

  Replace with:
  ```js
  document.querySelectorAll('.mode-card[data-mode]').forEach(card => {
    card.addEventListener('click', () => {
      setState({ mode: card.dataset.mode });
      render();
    });
  });
  ```

  Note: this sets `state.mode` to exactly the `data-mode` value (`'auto'` or `'flags'`) — no toggle logic needed since each card has an explicit target mode.

- [ ] **Step 3: Verify end-to-end in browser**

  Open `index.html` in Chrome. Test the full flow:
  1. Page loads: AUTO card highlighted teal, no flag widget, step counter shows "of 5+ steps"
  2. Click FLAGS card: FLAGS card highlighted red, AUTO card dim, flag drag widget visible showing "1", step counter shows "of 5+ flags"
  3. Drag flag widget to canvas: flag appears numbered "1"; widget updates to show "2"
  4. Drag another flag: widget shows "3"
  5. Click AUTO card: AUTO card highlighted, flag widget hides, existing flags on canvas remain visible, step counter switches back to connection-based count and shows "of 5+ steps"
  6. Flag no longer appears in the Materials library on the left
  7. No JS errors in console

- [ ] **Step 4: Commit**

  ```bash
  git add js/main.js
  git commit -m "feat: remove flag from library, wire mode-card click handlers (v2.5.36)"
  ```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `<h3>Steps</h3>` header identical in style to Requirements/BOM | Task 1 |
| Remove `#step-mode-header` div and flip switch | Task 1 |
| `#step-mode-cards` with two `.mode-card` buttons | Task 1 |
| `#flag-drag-widget` with `class="lib-item"` + `data-*` attrs + `hidden` | Task 1 |
| Active card: `1.5px solid` border + colored title | Task 2 |
| Inactive card: `1px solid #1a3a5c` border, dim title, opacity 0.5 | Task 2 |
| AUTO active: teal `#00c9a7`; FLAGS active: red `#ef476f` | Task 2 |
| Flag drag widget: dashed red border, draggable | Task 2 |
| Clicking a mode card calls `setState({ mode })` + `render()` | Task 4 |
| `flag` removed from `CATALOG.materials` | Task 4 |
| Mode cards toggle `.active` class in `updateTrackerUI()` | Task 3 |
| Widget show/hide based on `state.mode === 'flags'` | Task 3 |
| Widget shows `(flag count) + 1` | Task 3 |
| `widget.dataset.catalog` set so existing drop handler places flag correctly | Task 3 |
| Step counter label: "of 5+ steps" (AUTO) / "of 5+ flags" (FLAGS) | Already implemented — no change needed |
| Flags on canvas remain visible in AUTO mode | Already implemented in state/render — no change needed |

**Type consistency:** `state.mode` is `'auto'` or `'flags'` throughout (state.js, tracker.js, tracker-ui.js, main.js) — consistent.

**Placeholder scan:** No TBDs or TODOs. All code blocks complete.

**Scope check:** Four files, well-bounded. No unrelated changes.
