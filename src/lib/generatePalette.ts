import type { Palette, PaletteStep, LightnessRange, LabelScale, Project } from '../types/project'
import { DEFAULT_LIGHTNESS_RANGE, DEFAULT_PRESET, PALETTE_PRESETS } from '../types/project'
import { hexToOklch, clampToGamut, oklchToHex } from './color'
import { harmonize } from './harmonize'
import { contrastRatio } from './wcag'
import { inferPaletteName } from './paletteName'

export interface GenOpts {
  envelopeExponent?: number
  lightnessDistribution?: 'linear' | 'perceptual'
}

// Resolves generation opts for a single palette:
// named preset → preset config; manual → palette's own values; fallback → project values
export function paletteGenOpts(palette: Palette, project: Project): { opts: GenOpts; lRange: LightnessRange } {
  const preset = palette.preset ?? DEFAULT_PRESET
  if (preset !== 'manual') {
    const cfg = PALETTE_PRESETS[preset]
    return { opts: { envelopeExponent: cfg.envelopeExponent, lightnessDistribution: cfg.lightnessDistribution }, lRange: cfg.lightnessRange }
  }
  return {
    opts: {
      envelopeExponent: palette.envelopeExponent ?? project.envelopeExponent ?? 0.75,
      lightnessDistribution: palette.lightnessDistribution ?? project.lightnessDistribution ?? 'linear',
    },
    lRange: palette.lightnessRange ?? project.lightnessRange ?? DEFAULT_LIGHTNESS_RANGE,
  }
}

export function computeStepLabels(n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round((i * 1000) / (n - 1)))
}

export type GenerateError = 'too-light' | 'too-dark'

function stepColorCount(stepCount: number): number {
  return stepCount + 1
}

export function findBaseIndex(
  inputL: number,
  stepCount: number,
  mode: 'light' | 'dark' = 'light',
  lRange: LightnessRange = DEFAULT_LIGHTNESS_RANGE,
): number {
  const n = stepColorCount(stepCount)
  const L_START = mode === 'dark' ? lRange.darkest : lRange.lightest
  const L_END   = mode === 'dark' ? 0.85 : lRange.darkest
  const lightnesses = Array.from({ length: n }, (_, i) => L_START + (i / (n - 1)) * (L_END - L_START))
  let baseIndex = 0
  let minDiff = Infinity
  for (let i = 0; i < n; i++) {
    const diff = Math.abs(lightnesses[i]! - inputL)
    if (diff < minDiff || (diff === minDiff && i < baseIndex)) {
      minDiff = diff
      baseIndex = i
    }
  }
  return baseIndex
}

export function validateBasePosition(
  inputHex: string,
  stepCount: number,
  lRange: LightnessRange = DEFAULT_LIGHTNESS_RANGE,
): GenerateError | null {
  const [L] = hexToOklch(inputHex)
  const baseIndex = findBaseIndex(L, stepCount, 'light', lRange)
  const n = stepColorCount(stepCount)
  if (baseIndex === 0) return 'too-light'
  if (baseIndex === n - 1) return 'too-dark'
  return null
}

function makeStep(
  hex: string,
  label: number,
  isBase: boolean,
  locked: boolean,
  backgrounds: { light: string; dark: string },
): PaletteStep {
  const [l, c, h] = hexToOklch(hex)
  return {
    label,
    hex,
    isBase,
    locked,
    oklch: { l, c, h },
    contrast: {
      onLight: contrastRatio(hex, backgrounds.light),
      onDark: contrastRatio(hex, backgrounds.dark),
    },
  }
}

export function generateModeSteps(
  inputHex: string,
  stepCount: number,
  backgrounds: { light: string; dark: string },
  mode: 'light' | 'dark',
  lRange: LightnessRange = DEFAULT_LIGHTNESS_RANGE,
  opts: GenOpts = {},
): PaletteStep[] {
  const n = stepColorCount(stepCount)
  const [inputL, inputC, inputH] = hexToOklch(inputHex)
  const harmonizedSteps = harmonize(inputL, inputC, inputH, n, mode, lRange, opts)
  const baseIndex = findBaseIndex(inputL, stepCount, mode, lRange)
  const stepLabels = computeStepLabels(n)

  return harmonizedSteps.map((hs, i) => {
    const [L, C, H] = clampToGamut(hs.L, hs.C, hs.H)
    const hex = i === baseIndex ? inputHex : oklchToHex(L, C, H)
    return makeStep(hex, stepLabels[i] ?? Math.round((i * 100) / (n - 1)), i === baseIndex, false, backgrounds)
  })
}

export function generatePalette(
  inputHex: string,
  stepCount: number,
  backgrounds: { light: string; dark: string },
  existingPalettes: Palette[],
  lRange: LightnessRange = DEFAULT_LIGHTNESS_RANGE,
  opts: GenOpts = {},
): Palette {
  const [inputL, inputC, inputH] = hexToOklch(inputHex)
  const lightSteps = generateModeSteps(inputHex, stepCount, backgrounds, 'light', lRange, opts)
  const name = inferPaletteName(inputH, inputC, inputL, existingPalettes)

  return {
    id: crypto.randomUUID(),
    name,
    baseHex: inputHex,
    activeMode: 'light',
    modes: { light: lightSteps, dark: null },
  }
}

export function generateDarkMode(
  palette: Palette,
  backgrounds: { light: string; dark: string },
  lRange: LightnessRange = DEFAULT_LIGHTNESS_RANGE,
  opts: GenOpts = {},
): Palette {
  const stepCount = palette.modes.light.length - 1
  const darkSteps = generateModeSteps(palette.baseHex, stepCount, backgrounds, 'dark', lRange, opts)
  return { ...palette, modes: { ...palette.modes, dark: darkSteps } }
}

export function regeneratePalette(
  palette: Palette,
  stepCount: number,
  backgrounds: { light: string; dark: string },
  lRange: LightnessRange = DEFAULT_LIGHTNESS_RANGE,
  opts: GenOpts = {},
): Palette {
  const n = stepColorCount(stepCount)
  const newLabels = computeStepLabels(n)
  const snapThreshold = 500 / (n - 1)

  function remapMode(currentSteps: PaletteStep[], mode: 'light' | 'dark'): PaletteStep[] {
    // isBase steps are placed by generateModeSteps at the correct new position;
    // snapping them separately would create a duplicate at two indices.
    const lockedSteps = currentSteps.filter((s) => s.locked && !s.isBase)

    // Build candidates sorted by distance for one-to-one greedy matching
    const candidates: Array<{ dist: number; newIdx: number; locked: PaletteStep }> = []
    for (const locked of lockedSteps) {
      for (let i = 0; i < n; i++) {
        const dist = Math.abs(locked.label - newLabels[i]!)
        if (dist <= snapThreshold) {
          candidates.push({ dist, newIdx: i, locked })
        }
      }
    }
    candidates.sort((a, b) => a.dist - b.dist)

    const usedNewIdx = new Set<number>()
    const usedLocked = new Set<PaletteStep>()
    const assignments = new Map<number, PaletteStep>()

    for (const { newIdx, locked } of candidates) {
      if (!usedNewIdx.has(newIdx) && !usedLocked.has(locked)) {
        usedNewIdx.add(newIdx)
        usedLocked.add(locked)
        assignments.set(newIdx, locked)
      }
    }

    const freshSteps = generateModeSteps(palette.baseHex, stepCount, backgrounds, mode, lRange, opts)
    return freshSteps.map((freshStep, i) => {
      const locked = assignments.get(i)
      if (locked) {
        return makeStep(locked.hex, newLabels[i]!, locked.isBase, locked.locked, backgrounds)
      }
      return freshStep
    })
  }

  const lightSteps = remapMode(palette.modes.light, 'light')
  const darkSteps = palette.modes.dark ? remapMode(palette.modes.dark, 'dark') : null

  return { ...palette, modes: { light: lightSteps, dark: darkSteps } }
}

export function autoUpdatePalette(
  palette: Palette,
  backgrounds: { light: string; dark: string },
  lRange: LightnessRange = DEFAULT_LIGHTNESS_RANGE,
  opts: GenOpts = {},
): Palette {
  const stepCount = palette.modes.light.length - 1
  return regeneratePalette(palette, stepCount, backgrounds, lRange, opts)
}

export function recalcContrast(
  palette: Palette,
  backgrounds: { light: string; dark: string },
): Palette {
  function recalcSteps(steps: PaletteStep[]): PaletteStep[] {
    return steps.map((step) => ({
      ...step,
      contrast: {
        onLight: contrastRatio(step.hex, backgrounds.light),
        onDark: contrastRatio(step.hex, backgrounds.dark),
      },
    }))
  }
  return {
    ...palette,
    modes: {
      light: recalcSteps(palette.modes.light),
      dark: palette.modes.dark ? recalcSteps(palette.modes.dark) : null,
    },
  }
}

// ── Lightness-based label assignment ─────────────────────────────────────────

// Each scale snaps to a grid that keeps labels human-readable:
//   0-10   → integers   (0, 1, 2 … 10)
//   0-100  → multiples of 5   (0, 5, 10 … 100)
//   0-1000 → multiples of 50  (0, 50, 100 … 1000)
const LABEL_SNAP: Record<LabelScale, number> = {
  '0-10':   1,
  '0-100':  5,
  '0-1000': 50,
}

// Derive labels from each step's actual OKLCH lightness mapped into [0, maxVal],
// snapped to the scale's grid. Labels are derived from light-mode steps and applied
// to dark-mode steps by index so both modes stay in sync.
export function relabelPalette(
  palette: Palette,
  projectLightnessRange: LightnessRange,
  scale: LabelScale,
): Palette {
  const maxVal  = scale === '0-10' ? 10 : scale === '0-100' ? 100 : 1000
  const snap    = LABEL_SNAP[scale]
  const { lightest, darkest } = palette.lightnessRange ?? projectLightnessRange

  function buildLabels(steps: PaletteStep[]): number[] {
    const snapped = steps.map((step) => {
      const t = Math.max(0, Math.min(1, (lightest - step.oklch.l) / (lightest - darkest)))
      return Math.round(Math.round(t * maxVal) / snap) * snap
    })
    // Ensure strictly increasing; bump collisions by one snap step
    const labels = [...snapped]
    for (let i = 1; i < labels.length; i++) {
      if (labels[i]! <= labels[i - 1]!) labels[i] = labels[i - 1]! + snap
    }
    return labels
  }

  // Always derive from light mode; apply same indices to dark mode for consistency
  const labels = buildLabels(palette.modes.light)
  return {
    ...palette,
    modes: {
      light: palette.modes.light.map((s, i) => ({ ...s, label: labels[i]! })),
      dark: palette.modes.dark
        ? palette.modes.dark.map((s, i) => ({ ...s, label: labels[i]! }))
        : null,
    },
  }
}

// ── Legacy Tailwind label normalization (kept for internal use) ───────────────

const TAILWIND_LABELS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

export function normalizeTailwindLabels(
  palette: Palette,
  backgrounds: { light: string; dark: string },
  lRange: LightnessRange = DEFAULT_LIGHTNESS_RANGE,
): Palette {
  const stepCount = TAILWIND_LABELS.length - 1 // 10 → generates 11 steps

  function normalizeMode(mode: 'light' | 'dark'): PaletteStep[] {
    const freshSteps = generateModeSteps(palette.baseHex, stepCount, backgrounds, mode, lRange)
    return freshSteps.map((step, i) => ({ ...step, label: TAILWIND_LABELS[i]! }))
  }

  return {
    ...palette,
    modes: {
      light: normalizeMode('light'),
      dark: palette.modes.dark ? normalizeMode('dark') : null,
    },
  }
}
