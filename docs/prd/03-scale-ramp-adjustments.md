# PRD: Scale Ramp Adjustments

## Overview
The ramp shape, lightness curve, and step manipulation capabilities are all partially implemented but not fully surfaced. This PRD covers exposing the envelope exponent as a user control, adding a perceptual lightness curve option, improving locked step feedback, and surfacing the existing insert-step store action in the UI.

---

## Tasks

### A. Envelope exponent "feel" slider
- [ ] Add `envelopeExponent?: number` to the `Project` type in `types/project.ts`, defaulting to `0.75` when absent
- [ ] Pass `envelopeExponent` through the call chain: `generateModeSteps` → `harmonize` → `envelope(t, tBase, exponent)`
- [ ] In `useProjectStore`, add `updateEnvelopeExponent(value: number)` action that sets the value and calls `autoUpdatePalette` on all palettes
- [ ] Add a slider to the project screen (suggested location: inside the step detail panel's lightness range section, or as a new "Generation" section in the sidebar below the palette list)
  - Range: 0.4 (expressive) → 1.4 (even)
  - Step: 0.05
  - Label: two end labels "Expressive" and "Even", current value shown numerically
- [ ] Slider changes trigger live regeneration of all palettes (debounced 150ms to avoid jank)

### B. Perceptual lightness curve (linear vs. eased)
- [ ] Add `lightnessDistribution?: 'linear' | 'perceptual'` to the `Project` type, defaulting to `'linear'`
- [ ] In `harmonize()`, when `lightnessDistribution === 'perceptual'`, replace the linear interpolation of lightnesses with an ease-in-out curve:
  ```
  t_eased = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t + 2, 2) / 2
  L[i] = L_START + t_eased * (L_END - L_START)
  ```
  where `t = i / (n - 1)` as usual
- [ ] Add `updateLightnessDistribution(value: 'linear' | 'perceptual')` to the store
- [ ] Add a segmented toggle (Linear | Perceptual) to the same area as the envelope exponent slider
- [ ] Toggling triggers full palette regeneration

### C. Locked step indicator and loss warning
- [ ] In the palette detail view (step columns), add a small lock icon at the top of each column for steps where `step.locked === true`
  - Icon: `IconLock` from `@tabler/icons-react`, size 10, positioned `absolute top-2 left-1/2 -translate-x-1/2`
  - Color: derived from step luminance (same `textColor` logic used for the label)
- [ ] In `updateProjectStepCount()` in the store, before regenerating, calculate which locked steps will fall outside the snap threshold and collect their labels
- [ ] If any locked steps will be lost, show a toast warning: `"2 locked steps will be removed."`  before committing the change (use `toast.warning`)
- [ ] Clicking the step label in the step detail panel's Values section should show a "Lock / Unlock" toggle button beside the label (currently locking is only in the store, not exposed in UI)

### D. Insert step between columns (UI for existing store action)
- [ ] In the palette detail view, render a small `+` insert affordance between adjacent step columns
  - Visible only on hover of the gap between two columns
  - Rendered as an absolute-positioned `<button>` centered in the 4px gap between columns
  - Icon: `IconPlus` size 10
  - Style: circular, 18px, `bg-surface-base`, `border border-bd-base`, appears on `group-hover`
- [ ] Clicking the `+` affordance calls `insertStep(palette.id, leftStep.label, rightStep.label)` from the store
- [ ] Also add affordances at the far left (insert before step 0) and far right (insert after last step)
  - Left affordance: `insertStep(palette.id, null, firstStep.label)`
  - Right affordance: `insertStep(palette.id, lastStep.label, null)`
- [ ] After insert, the new step's panel opens automatically
- [ ] Enforce the existing max step count (20) — hide affordances when at limit

---

## Acceptance Criteria

- Setting the envelope exponent to 0.4 produces a palette where midrange steps are visibly more vivid than the same palette at exponent 1.2
- Switching to "Perceptual" distribution visibly clusters steps more densely in the 40–60% lightness band
- Both the exponent slider and distribution toggle persist across project save/reload
- Locked steps display a lock icon in the palette detail view
- Changing step count while locked steps exist and would be lost shows a warning toast before the change is applied
- A lock/unlock toggle is reachable from the step detail panel
- Clicking a `+` affordance between two step columns inserts a new step and opens its panel
- Insert affordances are hidden at the step count maximum (20 steps)
- No regression: existing step generation, lightness range sliders, and locked-step snap logic are unaffected when `envelopeExponent` is at its default (0.75) and `lightnessDistribution` is `'linear'`
