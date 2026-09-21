import type { CurveValues, Palette, PaletteStep, LightnessRange, LabelScale, Project } from '../types/project'
import { DEFAULT_LIGHTNESS_RANGE, DEFAULT_PRESET, PALETTE_PRESETS } from '../types/project'
import { hexToOklch, clampToGamut, oklchToHex } from './color'
import { computeLightnesses, harmonize } from './harmonize'
import { contrastRatio } from './wcag'
import { inferPaletteName } from './paletteName'
import { curveValuesFromOklch } from './curveEngine'

export interface GenOpts {
  envelopeExponent?: number
  lightChromaFalloff?: number
  darkChromaFalloff?: number
  lightHueShift?: number
  darkHueShift?: number
  lightnessDistribution?: 'linear' | 'perceptual'
}

// Resolves generation opts for a single palette:
// named preset → preset config; manual → palette's own values; fallback → project values
export function paletteGenOpts(palette: Palette, project: Project): { opts: GenOpts; lRange: LightnessRange } {
  const preset = palette.preset ?? DEFAULT_PRESET
  if (preset !== 'manual') {
    const cfg = PALETTE_PRESETS[preset]
    return {
      opts: {
        envelopeExponent: cfg.envelopeExponent,
        lightChromaFalloff: palette.lightChromaFalloff ?? cfg.envelopeExponent,
        darkChromaFalloff: palette.darkChromaFalloff ?? cfg.envelopeExponent,
        lightHueShift: palette.lightHueShift ?? 0,
        darkHueShift: palette.darkHueShift ?? 0,
        lightnessDistribution: cfg.lightnessDistribution,
      },
      lRange: cfg.lightnessRange,
    }
  }
  return {
    opts: {
      envelopeExponent: palette.envelopeExponent ?? project.envelopeExponent ?? 0.75,
      lightChromaFalloff: palette.lightChromaFalloff ?? palette.envelopeExponent ?? project.envelopeExponent ?? 0.75,
      darkChromaFalloff: palette.darkChromaFalloff ?? palette.envelopeExponent ?? project.envelopeExponent ?? 0.75,
      lightHueShift: palette.lightHueShift ?? 0,
      darkHueShift: palette.darkHueShift ?? 0,
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
  inputH = 0,
  opts: GenOpts = {},
): number {
  const n = stepColorCount(stepCount)
  const lightnesses = computeLightnesses(
    n,
    mode,
    lRange,
    inputH,
    opts.lightnessDistribution ?? 'linear',
  )
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
  opts: GenOpts = {},
  mode: 'light' | 'dark' = 'light',
): GenerateError | null {
  const [L, , H] = hexToOklch(inputHex)
  const baseIndex = findBaseIndex(L, stepCount, mode, lRange, H, opts)
  const n = stepColorCount(stepCount)
  if (baseIndex === 0) return mode === 'light' ? 'too-light' : 'too-dark'
  if (baseIndex === n - 1) return mode === 'light' ? 'too-dark' : 'too-light'
  return null
}

function makeStep(
  hex: string,
  label: number,
  isBase: boolean,
  locked: boolean,
  backgrounds: { light: string; dark: string },
  position: number,
  id: string = crypto.randomUUID(),
  curveValues?: CurveValues,
  mappedOklch?: PaletteStep['oklch'],
): PaletteStep {
  const [parsedL, parsedC, parsedH] = hexToOklch(hex)
  const { l, c, h } = mappedOklch ?? { l: parsedL, c: parsedC, h: parsedH }
  return {
    id,
    position,
    label,
    hex,
    isBase,
    locked,
    curveValues: curveValues ?? curveValuesFromOklch(l, c, h, h),
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
  const baseIndex = findBaseIndex(inputL, stepCount, mode, lRange, inputH, opts)
  const stepLabels = computeStepLabels(n)

  return harmonizedSteps.map((hs, i) => {
    const [L, C, H] = clampToGamut(hs.L, hs.C, hs.H)
    const hex = i === baseIndex ? inputHex : oklchToHex(L, C, H)
    const curveValues = curveValuesFromOklch(hs.L, hs.C, hs.H, inputH)
    if (i === baseIndex) Object.assign(curveValues, curveValuesFromOklch(inputL, inputC, inputH, inputH))
    return makeStep(
      hex,
      stepLabels[i] ?? Math.round((i * 100) / (n - 1)),
      i === baseIndex,
      false,
      backgrounds,
      i / (n - 1),
      undefined,
      curveValues,
      { l: L, c: C, h: H },
    )
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
    preset: 'manual',
    lightnessRange: { ...lRange },
    envelopeExponent: opts.envelopeExponent ?? 0.75,
    lightChromaFalloff: opts.lightChromaFalloff ?? opts.envelopeExponent ?? 0.75,
    darkChromaFalloff: opts.darkChromaFalloff ?? opts.envelopeExponent ?? 0.75,
    lightHueShift: opts.lightHueShift ?? 0,
    darkHueShift: opts.darkHueShift ?? 0,
    lightnessDistribution: opts.lightnessDistribution ?? 'linear',
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

export function generatePaletteForMode(
  inputHex: string,
  stepCount: number,
  backgrounds: { light: string; dark: string },
  existingPalettes: Palette[],
  mode: 'light' | 'dark',
  lRange: LightnessRange = DEFAULT_LIGHTNESS_RANGE,
  opts: GenOpts = {},
): Palette {
  const palette = generatePalette(inputHex, stepCount, backgrounds, existingPalettes, lRange, opts)
  if (mode === 'light') return palette

  return {
    ...generateDarkMode(palette, backgrounds, lRange, opts),
    activeMode: 'dark',
  }
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

  function remapMode(currentSteps: PaletteStep[], mode: 'light' | 'dark'): PaletteStep[] {
    // isBase steps are placed by generateModeSteps at the correct new position;
    // snapping them separately would create a duplicate at two indices.
    const lockedSteps = currentSteps.filter((s) => s.locked && !s.isBase)

    const freshSteps = generateModeSteps(palette.baseHex, stepCount, backgrounds, mode, lRange, opts)
    const baseIndex = freshSteps.findIndex((step) => step.isBase)

    // Build candidates sorted by distance for one-to-one greedy matching. The
    // generated base is reserved: an old anchor must never replace it.
    const candidates: Array<{ dist: number; newIdx: number; locked: PaletteStep }> = []
    for (const locked of lockedSteps) {
      for (let i = 0; i < n; i++) {
        if (i === baseIndex) continue
        const oldPosition = locked.position ?? currentSteps.indexOf(locked) / Math.max(1, currentSteps.length - 1)
        const dist = Math.abs(oldPosition - i / (n - 1))
        candidates.push({ dist, newIdx: i, locked })
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

    // Drop anchors whose lightness conflicts with their position relative to
    // the exact base. Such anchors cannot coexist with a monotonic ramp.
    const direction = mode === 'dark' ? 1 : -1
    const baseL = freshSteps[baseIndex]!.oklch.l
    const minGap = 0.001
    const compatible = new Map<number, PaletteStep>()
    let boundaryIndex = baseIndex
    let boundaryL = baseL
    for (const [index, locked] of [...assignments.entries()].filter(([index]) => index < baseIndex).sort((a, b) => b[0] - a[0])) {
      const [l] = hexToOklch(locked.hex)
      const followsBase = direction * (boundaryL - l) > minGap * (boundaryIndex - index)
      const followsEndpoint = index === 0
        || direction * (l - freshSteps[0]!.oklch.l) > minGap * index
      if (followsBase && followsEndpoint) {
        compatible.set(index, locked)
        boundaryIndex = index
        boundaryL = l
      }
    }
    boundaryIndex = baseIndex
    boundaryL = baseL
    for (const [index, locked] of [...assignments.entries()].filter(([index]) => index > baseIndex).sort((a, b) => a[0] - b[0])) {
      const [l] = hexToOklch(locked.hex)
      const followsBase = direction * (l - boundaryL) > minGap * (index - boundaryIndex)
      const followsEndpoint = index === n - 1
        || direction * (freshSteps[n - 1]!.oklch.l - l) > minGap * (n - 1 - index)
      if (followsBase && followsEndpoint) {
        compatible.set(index, locked)
        boundaryIndex = index
        boundaryL = l
      }
    }
    assignments.clear()
    for (const [index, locked] of compatible) assignments.set(index, locked)

    const knotMap = new Map<number, { index: number; freshL: number; targetL: number; dc: number; dh: number }>()
    const zeroKnot = (index: number) => {
      const fresh = freshSteps[index]!
      knotMap.set(index, { index, freshL: fresh.oklch.l, targetL: fresh.oklch.l, dc: 0, dh: 0 })
    }
    zeroKnot(0)
    zeroKnot(n - 1)
    for (const [index, locked] of assignments) {
      const fresh = freshSteps[index]!
      const [l, c, h] = hexToOklch(locked.hex)
      let dh = h - fresh.oklch.h
      if (dh > 180) dh -= 360
      if (dh < -180) dh += 360
      knotMap.set(index, { index, freshL: fresh.oklch.l, targetL: l, dc: c - fresh.oklch.c, dh })
    }
    // The base is an immutable zero-correction knot, even when an old locked
    // step previously occupied the same normalized position.
    zeroKnot(baseIndex)
    const correctionKnots = [...knotMap.values()].sort((a, b) => a.index - b.index)

    function correctedStep(step: PaletteStep, index: number): PaletteStep {
      if (step.isBase) return step
      if (assignments.has(index)) return step
      let left = correctionKnots[0]!
      let right = correctionKnots[correctionKnots.length - 1]!
      for (const knot of correctionKnots) {
        if (knot.index <= index) left = knot
        if (knot.index >= index) { right = knot; break }
      }
      const span = Math.max(1, right.index - left.index)
      const t = (index - left.index) / span
      const mix = (a: number, b: number) => a + (b - a) * t
      const freshLSpan = right.freshL - left.freshL
      const lightnessT = Math.abs(freshLSpan) < 1e-9
        ? t
        : (step.oklch.l - left.freshL) / freshLSpan
      const [l, c, h] = clampToGamut(
        left.targetL + lightnessT * (right.targetL - left.targetL),
        Math.max(0, step.oklch.c + mix(left.dc, right.dc)),
        (step.oklch.h + mix(left.dh, right.dh) + 360) % 360,
      )
      return makeStep(
        oklchToHex(l, c, h),
        step.label,
        step.isBase,
        false,
        backgrounds,
        step.position,
        step.id,
        curveValuesFromOklch(l, c, h, hexToOklch(palette.baseHex)[2]),
        { l, c, h },
      )
    }
    const curvedSteps = freshSteps.map(correctedStep)
    const preservedIds = new Map<number, string>()
    const usedOldIds = new Set([...assignments.values()].map((step) => step.id))
    const usedIndexes = new Set(assignments.keys())
    const idCandidates = currentSteps.flatMap((step, oldIndex) => {
      if (usedOldIds.has(step.id)) return []
      const oldPosition = step.position ?? oldIndex / Math.max(1, currentSteps.length - 1)
      return curvedSteps.map((freshStep, newIdx) => ({
        distance: Math.abs(oldPosition - freshStep.position),
        newIdx,
        step,
      }))
    }).sort((a, b) => a.distance - b.distance)
    for (const candidate of idCandidates) {
      if (usedOldIds.has(candidate.step.id) || usedIndexes.has(candidate.newIdx)) continue
      usedOldIds.add(candidate.step.id)
      usedIndexes.add(candidate.newIdx)
      preservedIds.set(candidate.newIdx, candidate.step.id)
    }
    return curvedSteps.map((freshStep, i) => {
      const locked = assignments.get(i)
      if (locked) {
        return makeStep(
          locked.hex,
          newLabels[i]!,
          false,
          true,
          backgrounds,
          freshStep.position,
          locked.id,
          locked.curveValues,
          locked.oklch,
        )
      }
      return { ...freshStep, id: preservedIds.get(i) ?? freshStep.id }
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
  const configuredSnap = LABEL_SNAP[scale]
  void projectLightnessRange

  function buildLabels(steps: PaletteStep[]): number[] {
    const intervals = Math.max(1, steps.length - 1)
    const snap = intervals <= maxVal / configuredSnap
      ? configuredSnap
      : maxVal / intervals
    const decimals = snap < 1 ? Math.min(3, Math.ceil(-Math.log10(snap)) + 1) : 0
    return steps.map((step, i) => {
      const position = step.position ?? i / intervals
      const value = Math.round((position * maxVal) / snap) * snap
      return Number(value.toFixed(decimals))
    })
  }

  // Always derive from light mode; apply same indices to dark mode for consistency
  const labels = buildLabels(palette.modes.light)
  return {
    ...palette,
    modes: {
      light: palette.modes.light.map((s, i) => ({ ...s, label: labels[i]!, position: i / Math.max(1, labels.length - 1) })),
      dark: palette.modes.dark
        ? palette.modes.dark.map((s, i) => ({ ...s, label: labels[i]!, position: i / Math.max(1, labels.length - 1) }))
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
