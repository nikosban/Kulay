import type { Palette } from '../types/project'

// OKLCH hue → perceptual color name.
// Uses all three OKLCH dimensions:
//   C < 0.008          → true achromatic   → "Gray"
//   0.008 ≤ C < 0.045  → tinted neutral    → hue-directional name
//   C ≥ 0.045          → chromatic:
//     L < 0.32         → dark overrides   (Navy, Maroon, Forest…)
//     L > 0.82         → light overrides  (Powder, Blush, Mint…)
//     otherwise        → mid-tone names calibrated against Tailwind 500 swatches
function hueToName(H: number, C: number, L: number): string {
  // ── True gray ─────────────────────────────────────────────────────────────
  if (C < 0.008) return 'Gray'

  // ── Tinted neutral (perceivable hue but still reads as a gray) ────────────
  if (C < 0.045) {
    if (H <  60 || H >= 330) return 'Stone'   // warm: red/orange tint
    if (H < 110)             return 'Sand'    // earthy: yellow/lime tint
    if (H < 165)             return 'Sage'    // organic: green tint
    if (H < 240)             return 'Slate'   // cool: cyan/blue tint
    return                          'Mauve'   // muted: violet/purple tint
  }

  // ── Dark chromatic  (L < 0.32) ────────────────────────────────────────────
  if (L < 0.32) {
    if (H <  50 || H >= 340) return 'Maroon'
    if (H <  74)             return 'Rust'
    if (H < 112)             return 'Olive'
    if (H < 162)             return 'Forest'
    if (H < 198)             return 'Dark Teal'
    if (H < 269)             return 'Navy'
    if (H < 298)             return 'Midnight'
    return                          'Plum'
  }

  // ── Light chromatic  (L > 0.82) ───────────────────────────────────────────
  if (L > 0.82) {
    if (H <  32 || H >= 340) return 'Blush'
    if (H <  74)             return 'Peach'
    if (H < 112)             return 'Cream'
    if (H < 162)             return 'Mint'
    if (H < 198)             return 'Seafoam'
    if (H < 269)             return 'Powder'
    if (H < 313)             return 'Lavender'
    return                          'Petal'
  }

  // ── Mid-tone chromatic ────────────────────────────────────────────────────
  // Boundaries are midpoints between adjacent Tailwind 500 hue anchors in OKLCH.
  if (H <   8)  return 'Rose'       //   0–7    wraps from pink end
  if (H <  20)  return 'Red'        //   8–19
  if (H <  32)  return 'Tomato'     //  20–31
  if (H <  48)  return 'Orange'     //  32–47
  if (H <  60)  return 'Amber'      //  48–59
  if (H <  74)  return 'Gold'       //  60–73
  if (H <  90)  return 'Yellow'     //  74–89
  if (H < 112)  return 'Lime'       //  90–111
  if (H < 142)  return 'Green'      // 112–141
  if (H < 162)  return 'Emerald'    // 142–161
  if (H < 178)  return 'Teal'       // 162–177
  if (H < 198)  return 'Cyan'       // 178–197
  if (H < 249)  return 'Sky'        // 198–248  (midpoint sky-500↔blue-500: 248.6°)
  if (H < 269)  return 'Blue'       // 249–268  (midpoint blue-500↔indigo-500: 268.5°)
  if (H < 285)  return 'Indigo'     // 269–284  (midpoint indigo-500↔violet-500: 284.9°)
  if (H < 298)  return 'Violet'     // 285–297  (midpoint violet-500↔purple-500: 298.3°)
  if (H < 313)  return 'Purple'     // 298–312  (midpoint purple-500↔fuchsia-500: 313.0°)
  if (H < 331)  return 'Fuchsia'    // 313–330  (fuchsia-500 sits at 322.1°)
  if (H < 352)  return 'Pink'       // 331–351
  return 'Rose'                      // 352–360 (wraps same as 0–7)
}

export function inferPaletteName(H: number, C: number, L: number, existingPalettes: Palette[]): string {
  const base = hueToName(H, C, L)
  const existing = existingPalettes.map((p) => p.name)
  if (!existing.includes(base)) return base
  let index = 2
  while (existing.includes(`${base} ${index}`)) index++
  return `${base} ${index}`
}
