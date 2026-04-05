# Rubik's Cube Color Modes Redesign

## Overview

Replace the current 4 fixed color themes (Classic, Pastel, Neon, Solved) with 3 new modes that simulate actual cube states: Mixed, Partially Solved, and Solved. Colors are derived from the 6 standard Rubik's cube face colors.

## Standard Colors

The 6 standard Rubik's cube colors used across all modes:

| Index | Color  | Hex       |
|-------|--------|-----------|
| 0     | Red    | `#e5383b` |
| 1     | Blue   | `#3a86ff` |
| 2     | Green  | `#38b000` |
| 3     | Yellow | `#ffd166` |
| 4     | White  | `#f5f5f5` |
| 5     | Orange | `#fb5607` |

## Three Modes

### Mode 0 — Mixed (🎲)
All 27 visible cells (9 front + 9 top + 9 right) are individually colored using a deterministic scramble derived from `colorSeed`. Colors are drawn from the 6 standard colors. Looks like a fully scrambled cube.

### Mode 1 — Partially Solved (🔄)
Each visible face has:
- **Bottom row** (3 cells): one solid color, same for all 3 cells on that face, derived from `colorSeed`
- **Top 2 rows** (6 cells): randomly scrambled from the 6 standard colors, same scramble as Mixed (same seed)

Each face's bottom-row color is independently derived from the seed. Looks like a cube mid-solve.

### Mode 2 — Solved (✅)
Each of the 3 visible faces shows one solid color across all 9 cells. The 3 face colors are stored in `faceColors` (3 indices into standard colors, no repeats). `faceColors` is regenerated with a new random pick each time the user cycles TO solved mode, so the solved cube looks different each time.

## State Shape

New fields on `subParts`:

```js
subParts: {
  colorMode: 0 | 1 | 2,   // 0=mixed, 1=partial, 2=solved
  colorSeed: <integer>,    // set at placement; drives mixed/partial scramble
  faceColors: [i, j, k],  // 3 indices into STANDARD_COLORS; regenerated on each cycle to solved
}
```

`colorSeed` is set once at placement (`Math.floor(Math.random() * 1e9)`) and never changes.

`faceColors` is regenerated each time the user cycles to mode 2. It picks 3 distinct colors randomly from the 6 standard colors.

## Backwards Compatibility

Old saves have `colorIndex` (0–3) and no `colorMode`. Migration rule applied at render time:
- If `colorMode` is undefined and `colorIndex` is present → treat as `colorMode: 0` (mixed) with a fallback seed of `colorIndex` (produces a valid if arbitrary scramble).
- If both are undefined → default to `colorMode: 0`, seed `0`.

No state migration needed — defaults are applied at render time.

## Seeded Random

A simple inline mulberry32 PRNG produces deterministic cell color sequences from `colorSeed`. This avoids storing all 27 cell values in state.

```js
function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}
```

**Cell color assignment for Mixed:** Call `rand()` once per cell (27 total, front→top→right, row-major), take `Math.floor(result * 6)` as color index.

**Bottom-row color for Partial:** Use a separate rand instance seeded with `colorSeed + 1`. Call `rand()` once per face (3 calls) to get each face's bottom-row color index. Top 2 rows use the same scramble as Mixed (seeded with `colorSeed`).

## Files Changed

| File | Change |
|------|--------|
| `js/render/materials.js` | Replace `RUBIKS_THEMES` logic with seeded scramble + `drawRubiksCube` mode branches |
| `js/render/ui.js` | Update `colorNames` to `['🎲','🔄','✅']`, modulo to `% 3` |
| `js/main.js` | Update default `subParts` for rubiksCube; update cycle action to regenerate `faceColors` on mode 2, modulo to `% 3` |

## Out of Scope

- No changes to other component types
- No changes to attach points, resize behavior, or PNG export format
- The sidebar library preview always shows mixed mode (colorIndex 0 fallback)
