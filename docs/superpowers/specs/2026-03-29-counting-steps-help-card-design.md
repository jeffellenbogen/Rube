# Counting Steps Help Card Design Spec

## Goal

Add a sixth guide card to the help modal that explains how step counting works in both AUTO and FLAGS modes, positioned after the existing "Connecting Steps" card.

## Background

The help modal's Guide tab has 5 cards: Welcome, Adding Components, Connecting Steps, The Checklist, Saving & Loading. After implementing the Flag UX redesign (v2.5.36), students now choose between AUTO and FLAGS mode for step counting. Neither the guide nor the existing "Connecting Steps" card explains the difference. Students may be confused when AUTO mode doesn't count steps the way they expect.

---

## Section 1: Card Placement

The new card inserts at index 3 (0-based) in the `GUIDE_CARDS` array in `js/help.js`, making it card **4 of 6** in the rendered guide. It appears after "Connecting Steps" and before "The Checklist".

The existing navigation (step counter, dots, prev/next buttons) auto-updates to 6 cards — no navigation changes needed.

---

## Section 2: Illustration

**Function:** `drawCountingStepsIllustration(svg)`

**SVG dimensions:** `viewBox="0 0 140 110"`, `width="280"`, `height="220"` — matching all other guide illustrations.

The illustration shows the same example machine in two panels side by side:

### Left panel — AUTO mode (teal)
- Background `#0d1f35`, border `#1a3a5c`, label "AUTO" in `#00c9a7`
- Components: lever (brown rect + triangle fulcrum), ball (light circle), three dominoes
- Teal connector dots on lever output and ball output, dashed teal lines between them
- A brace over the three dominoes with label "1 step" in `#4a7a9a`
- Step number badges ① and ② above lever and ball respectively (teal circles with dark numbers)
- Step counter reading **2** in `#00c9a7` with sub-label "of 5+ steps"

### Right panel — FLAGS mode (red)
- Background `#110818`, border `#3a1a2a`, label "FLAGS" in `#ef476f`
- Same components rendered dim (fill `#4a3020` for wood, `#444`/`#555` for ball and dominoes) — no connector dots
- Three red flag markers numbered 1, 2, 3 placed above the lever, ball, and dominoes respectively
  - Each flag: red rect `#ef476f`, white number text, teal vertical pole `#4a7a9a`, teal circle base
- Step counter reading **3** in `#ef476f` with sub-label "of 5+ flags"

### Floor line
A single `#4a7a9a` horizontal line at the bottom of the full SVG canvas spans both panels.

---

## Section 3: Text Content

**Title:** `Counting Steps`

**Description (HTML, supports `<em>`):**

```
<em>AUTO</em> mode counts steps by following your connections — each different type of component in the chain is one step. <em>FLAGS</em> mode lets you decide: drag a Step Flag onto the canvas wherever a new step begins.<br><br><small>Heads up: in AUTO, a row of the same type (like 3 dominoes) counts as one step, not three. Use FLAGS if you want to count each part separately.</small>
```

`<em>` renders in the existing help card style (lighter color). `<small>` renders at reduced size for the "heads up" note.

---

## Section 4: Files Modified

| File | Change |
|---|---|
| `js/help.js` | Add `drawCountingStepsIllustration(svg)` function; insert new card object at index 3 of `GUIDE_CARDS` |

No other files change. The nav, tabs, modal, and CSS require no updates.

---

## Out of Scope

- Changes to the Reference tab
- Any changes to how step counting actually works
- Tooltip or overlay on the mode cards in the tracker panel
- Any animation in the illustration
