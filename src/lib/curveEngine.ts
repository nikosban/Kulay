import type { CurveConstraintStrategy, CurveType, CurveValues, PaletteStep } from '../types/project'
import { clampToGamut, maxChromaInGamut, oklchToHex } from './color'

export const DEFAULT_CURVE_STRATEGY: CurveConstraintStrategy = 'free'
export const HUE_OFFSET_RANGE = 360

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function hueCurveValueToDegrees(value: number): number {
  return (clamp01(value) - 0.5) * HUE_OFFSET_RANGE
}

export function hueDegreesToCurveValue(degrees: number): number {
  return clamp01(degrees / HUE_OFFSET_RANGE + 0.5)
}

export function migrateLegacyHueCurveValue(value: number): number {
  return hueDegreesToCurveValue((clamp01(value) - 0.5) * 40)
}

export function shortestHueOffset(hue: number, baseHue: number): number {
  let offset = hue - baseHue
  while (offset > 180) offset -= 360
  while (offset < -180) offset += 360
  return offset
}

/** Used at input/migration boundaries only. Runtime edits use stored intent. */
export function curveValuesFromOklch(l: number, c: number, h: number, baseHue: number): CurveValues {
  const maximum = maxChromaInGamut(l, h)
  return {
    lightness: clamp01(l),
    chroma: maximum > 0 ? clamp01(c / maximum) : 0,
    hue: hueDegreesToCurveValue(shortestHueOffset(h, baseHue)),
  }
}

export function renderCurveValues(values: CurveValues, baseHue: number): {
  oklch: PaletteStep['oklch']
  hex: string
} {
  const l = clamp01(values.lightness)
  const h = (baseHue + hueCurveValueToDegrees(values.hue) + 360) % 360
  const c = maxChromaInGamut(l, h) * clamp01(values.chroma)
  const [mappedL, mappedC, mappedH] = clampToGamut(l, c, h)
  return {
    oklch: { l: mappedL, c: mappedC, h: mappedH },
    hex: oklchToHex(mappedL, mappedC, mappedH),
  }
}

export function curveValue(step: PaletteStep, type: CurveType): number {
  return step.curveValues[type]
}

function monotonicBounds(values: number[], index: number): [number, number] {
  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 1
  const ascending = last >= first
  const previous = values[index - 1]
  const next = values[index + 1]
  return ascending
    ? [previous ?? 0, next ?? 1]
    : [next ?? 0, previous ?? 1]
}

export function constrainSeriesValue(
  values: number[],
  index: number,
  value: number,
  strategy: CurveConstraintStrategy,
  anchoredIndexes: ReadonlySet<number> = new Set(),
): number {
  const clamped = clamp01(value)
  if (strategy === 'anchored' && anchoredIndexes.has(index)) return values[index] ?? clamped
  if (strategy !== 'monotonic') return clamped
  const [minimum, maximum] = monotonicBounds(values, index)
  return minimum > maximum ? values[index] ?? clamped : Math.max(minimum, Math.min(maximum, clamped))
}

export function editSeries(
  values: number[],
  index: number,
  value: number,
  strategy: CurveConstraintStrategy,
  anchoredIndexes: ReadonlySet<number> = new Set(),
): number[] {
  const result = [...values]
  if (result[index] === undefined) return result
  result[index] = constrainSeriesValue(values, index, value, strategy, anchoredIndexes)
  if (strategy === 'smooth') {
    if (result[index - 1] !== undefined && !anchoredIndexes.has(index - 1)) result[index - 1] = result[index - 1]! * 0.75 + result[index]! * 0.25
    if (result[index + 1] !== undefined && !anchoredIndexes.has(index + 1)) result[index + 1] = result[index + 1]! * 0.75 + result[index]! * 0.25
  }
  return result
}

export function constrainCurveValue(
  steps: PaletteStep[],
  index: number,
  type: CurveType,
  value: number,
  strategy: CurveConstraintStrategy = DEFAULT_CURVE_STRATEGY,
): number {
  const clamped = clamp01(value)
  const step = steps[index]
  if (!step) return clamped
  const values = steps.map((candidate) => candidate.curveValues[type])
  const anchors = new Set(steps.flatMap((candidate, candidateIndex) => candidate.isBase ? [candidateIndex] : []))
  return constrainSeriesValue(values, index, clamped, strategy, anchors)
}

/** Applies an explicit strategy to intent. Smooth is the only propagating mode. */
export function editCurveIntent(
  steps: PaletteStep[],
  index: number,
  type: CurveType,
  value: number,
  strategy: CurveConstraintStrategy = DEFAULT_CURVE_STRATEGY,
): CurveValues[] {
  const result = steps.map((step) => ({ ...step.curveValues }))
  if (!result[index]) return result
  const anchors = new Set(steps.flatMap((step, stepIndex) => step.isBase ? [stepIndex] : []))
  const edited = editSeries(steps.map((step) => step.curveValues[type]), index, value, strategy, anchors)
  result.forEach((intent, intentIndex) => { intent[type] = edited[intentIndex]! })
  return result
}

export function applyCurveIntent(
  steps: PaletteStep[],
  type: CurveType,
  requested: number[],
  strategy: CurveConstraintStrategy = DEFAULT_CURVE_STRATEGY,
): CurveValues[] {
  let values = steps.map((step, index) => ({ ...step.curveValues, [type]: clamp01(requested[index] ?? step.curveValues[type]) }))
  if (strategy === 'anchored') {
    values = values.map((value, index) => steps[index]!.isBase ? { ...value, [type]: steps[index]!.curveValues[type] } : value)
  } else if (strategy === 'monotonic' && values.length > 1) {
    const ascending = values[values.length - 1]![type] >= values[0]![type]
    for (let index = 1; index < values.length; index++) {
      values[index]![type] = ascending
        ? Math.max(values[index - 1]![type], values[index]![type])
        : Math.min(values[index - 1]![type], values[index]![type])
    }
  } else if (strategy === 'smooth' && values.length > 2) {
    const source = values.map((value) => value[type])
    for (let index = 1; index < values.length - 1; index++) {
      if (!steps[index]!.isBase) values[index]![type] = source[index - 1]! * 0.25 + source[index]! * 0.5 + source[index + 1]! * 0.25
    }
  }
  return values
}
