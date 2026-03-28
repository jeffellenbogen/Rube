# Flag Mode Design Spec

## Goal

Add a second step-counting mode where students manually mark steps by placing numbered flag components on the canvas, as an alternative to the automatic connection-based step detection.

## Background

The automatic `countSteps()` algorithm infers steps from the component graph. Some students may conceptualize cause→effect steps differently than the algorithm detects. Flag mode lets students self-annotate their design with explicit step markers, enabling an A/B comparison of both approaches in classroom use.

## Architecture

One site, one URL. A labeled flip switch in the tracker sidebar toggles between AUTO mode (existing behavior) and FLAG mode (flag-based step counting). `state.mode` persists the choice. No second deployment needed.

---

## Section 1: Overview

- Single URL; mode is toggled in-session via the tracker sidebar
- AUTO mode: site behaves exactly as today — `countSteps()` drives the step counter
- FLAG mode: step count = number of flag components placed on the canvas
- Switching modes does not add or remove flags — they persist invisibly in AUTO mode and become active again when switching back to FLAG mode

---

## Section 2: Flag Component

**Visual:** Badge-on-pole. A rectangular red badge with "STEP" in small text above a large bold auto-number, a vertical pole below, and a small dot at the base.

**Subtype:** `flag` (component type: `material`)

**Library:** Always visible in the library regardless of current mode.

**Auto-numbering:** Flag numbers are computed at render time from the flag's index among all `flag` subtype components in `state.components` — no number is stored on the component. The first flag in the array = Step 1, second = Step 2, etc. Deleting a flag automatically shifts all higher numbers down by one. When a new flag is added after a deletion, it receives the next available number.

**Connection points:** None. Flags cannot be wired into the chain — they are purely annotation.

**Comment bubble:** Flags support the existing comment system. Double-clicking a flag opens a textarea bubble (placeholder: "Describe this step...") positioned above the flag, identical to all other components. Comment text is stored in `component.comment` and toggled via `component.commentVisible`.

**Undo/redo:** Fully supported — flags use the existing component undo stack.

---

## Section 3: Mode Toggle

**Location:** Tracker sidebar, inline with the "STEP COUNTING" section header — "AUTO" and "FLAGS" labels flank a small flip switch on the right side.

**Visual state:**
- AUTO mode: switch left, "AUTO" label highlighted
- FLAG mode: switch right, "FLAGS" label highlighted in red

**State field:** `state.mode` — `'auto'` (default) or `'flags'`

**AUTO mode behavior:**
- Step count = `countSteps(state)`, unchanged from today
- Teal when ≥ 5 steps, same as today
- Flag components on canvas remain visible but are ignored by the counter

**FLAG mode behavior:**
- Step count = `state.components.filter(c => c.subtype === 'flag').length`
- Teal when ≥ 5, red when < 5
- `countSteps()` is not called

---

## Section 4: PNG Export & State

- `state.mode` is serialized into the PNG iTXt metadata chunk alongside all other state — uploading a saved PNG restores both the canvas and the correct mode
- Flags render on the canvas layer in the PNG export, identical to any other component
- The STEPS panel in the PNG's BOM sidebar reflects the active mode: flag count if `state.mode === 'flags'`, auto-count otherwise
- Flag `comment` text is serialized as part of the component, same as all other components

---

## Out of Scope

- URL parameter to pre-select mode (can be added later as a cheap extension)
- Any changes to the `countSteps()` algorithm
- Physics simulation or step validation
