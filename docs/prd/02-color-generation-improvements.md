# PRD: Color Generation Improvements

## Overview
The generation pipeline in `harmonize.ts` and `generatePalette.ts` has several limitations that produce suboptimal results for specific hue ranges and edge cases. This PRD covers four targeted improvements to the generation algorithm.

---

## Tasks

### A. Neutral / gray palette generation
- [ ] In `harmonize.ts`, locate the `isNeutral` branch (`inputC < 0.04`)
- [ ] Instead of copying `inputC` flat across all steps, derive a temperature direction from the input hue:
  - Hue in warm range (0–60°, 320–360°): apply a small warm tint (`C = 0.01–0.015`, `H = inputH`)
  - Hue in cool range (180–280°): apply a small cool tint (`C = 0.008–0.012`, `H = inputH`)
  - Otherwise: use `C = 0` (pure gray)
- [ ] Apply the standard chroma envelope on top of this tint so extremes fade to true gray
- [ ] Verify that entering `#808080`, `#FAFAFA`, and `#1A1A1A` as base colors produces perceptibly different neutral palettes (warm, cool, and pure)

### B. Base step uses exact input L, not snapped L
- [ ] In `harmonize.ts` → `harmonize()`, the base step currently re-uses `lightnesses[baseIndex]` as its L value
- [ ] Change: for the step at `i === baseIndex`, return `{ L: inputL, C: inputC, H: inputH + hueShift(...) }` instead of the grid-snapped `L`
- [ ] In `generateModeSteps()` in `generatePalette.ts`, confirm that `i === baseIndex` already replaces the generated color with `inputHex` directly — this is the safety net; the harmonize fix just keeps the envelope math consistent
- [ ] Verify that a color entered at L = 0.61 is not visibly shifted to L = 0.60 or 0.625 in the output

### C. Adaptive dark mode ceiling per hue
- [ ] In `harmonize.ts` → `harmonize()`, the `L_END` for dark mode is hardcoded to `0.85`
- [ ] Replace with a `maxDarkL(H: number): number` function that probes the hue's actual gamut:
  - Start from L = 0.92, step down by 0.01 until `clampToGamut(L, 0.18, H)` returns a C within 5% of the input
  - Return that L, clamped to `[0.82, 0.92]`
- [ ] Import `clampToGamut` into `harmonize.ts` (it is currently only in `color.ts`)
- [ ] Verify that a bright cyan base color reaches a lighter top step in dark mode than a deep indigo base

### D. Extend Abney correction to dark-end steps
- [ ] In `harmonize.ts` → `hueShift()`, the corrections use `lightness = 1 - stepFraction`, so they only fire strongly near the light end
- [ ] Add a symmetric dark-end correction using `darkness = stepFraction`:
  - Reds dark end: `+2 * Math.pow(darkness, 2)` (reds drift toward maroon; pull back slightly)
  - Blues dark end: `+3 * Math.pow(darkness, 2)` (blues drift toward indigo; pull back toward blue)
  - Greens dark end: `-2 * Math.pow(darkness, 2)` (greens drift toward teal; pull back toward green)
- [ ] Combine with existing light-end corrections in a single return statement per hue range
- [ ] Verify dark steps of a red palette don't read as brown, a blue palette's darkest step reads as dark blue not dark purple

---

## Acceptance Criteria

- A hex input of `#9CA3AF` (cool gray) generates a scale with a faint cool tint at midrange steps and fades to white/black at the extremes, not flat gray
- A hex input of `#D97706` (warm amber) generates a scale whose lightest step in dark mode reaches at least L = 0.88 (amber has wide gamut at high lightness)
- A hex input of `#6366F1` (indigo) generates a dark mode scale whose lightest step is capped below L = 0.87 (indigo clips earlier)
- For a red base color, the darkest step reads as dark red, not brown or maroon
- For a blue base color, the darkest step reads as dark blue, not dark purple
- No regression: existing palette outputs for standard hues (red, blue, green, yellow, purple) do not visually regress from the current output for mid-range base inputs
- All changes are confined to `harmonize.ts` and do not alter the function signatures consumed by `generatePalette.ts`
