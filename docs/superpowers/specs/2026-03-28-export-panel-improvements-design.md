# Export Panel Improvements Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the exported PNG readable when printed and add a simple machines checklist and mode-aware steps label to the right panel.

**Branch:** `Flags-Test`

---

## Problems Being Solved

1. **Text too small to read when printed.** The export panel uses 10–12px headers and 11px item text. At 150 DPI logical coordinates (the page is 11"×8.5" at 150 DPI), this renders as ~5–6pt on paper — illegible without zooming.
2. **Comment bubbles illegible.** Comment boxes use 9px font (~4.3pt printed).
3. **Simple machines section shows only placed machines.** It should show all 6 machine types as a checklist so students can see what they still need.
4. **Steps section doesn't indicate mode.** "2 of 5+" doesn't tell you if those steps were auto-detected or manually flagged.

---

## Design Decisions

### 1. Text Size — Large

All panel text increases to ~10pt equivalent at print size:

| Element | Old (px) | New (px) |
|---|---|---|
| Panel title "MATERIALS USED" | 12 | 20 |
| Section headers (SIMPLE MACHINES, etc.) | 10 | 16 |
| Item rows | 11 | 17 |
| Summary lines ("N of 3 required") | — | 13 |
| Comment bubble font | 9 | 13 |
| Comment bubble line height | 12 | 17 |

Row spacing and section gaps increase proportionally: item rows `pY += 20` (was 15), section gap after items `pY += 14` (was 10), section header + rule `pY += 18` (was 14).

### 2. Simple Machines — Checkbox Checklist

Replace the current "list only placed machines with count" approach with a full 6-item checklist showing all machine types:

- **Used:** filled teal square (■) + machine name in dark text
- **Not used:** empty square (□) with grey border + machine name in grey text
- Summary line below: `N of 3 required` — teal if met (≥3), red if not

The checklist always shows all 6 in a fixed order: Lever, Pulley, Inclined Plane, Wheel & Axle, Wedge, Screw.

The existing BOM count of placed machines (e.g., "Lever 2×") moves entirely to the MATERIALS section treatment — machines are no longer listed there at all since the checklist covers them.

**Implementation:** The checkbox square is drawn on canvas as a filled or empty rect with rounded corners (rx=2). Teal fill `#00c9a7` when used, white fill + `#ccc` border when not.

### 3. Steps Section — Mode-Aware Heading

The "STEPS" section header becomes:
- **AUTO mode:** `STEPS (AUTO)` in teal (`#00c9a7`)
- **FLAGS mode:** `STEPS (FLAGS)` in red (`#ef476f`)

The count line (`N of 5+`) remains as-is, colored teal when met, dark (`#1a1a3a`) when not met — same logic as today.

`state.mode` is already available in `export.js` via `getState()`. The `getRequirements(state)` call is already present and returns `req.steps` and `req.stepsMet`.

---

## Files to Modify

- **`js/export.js`** — the only file that needs changes. All three improvements are self-contained in `downloadPNG()`.

No other files are affected. Tests in `js/test/export.test.js` cover `encodeITXt`/`decodeITXt` only — no new tests needed (the rendering is a canvas draw function with no testable output).

---

## Out of Scope

- Changing the panel width (260px stays)
- Adding flag icons or step flag numbers to the export panel
- Any changes to the live sidebar tracker UI
