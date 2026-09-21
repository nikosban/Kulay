import type { CurveCorrectionPoint, CurveShapePreset, CurveType, Palette, PaletteStep, SavedCurve } from '../types/project'
import { curvePlotValue } from './curveChart'
import { contrastRatio } from './wcag'
import { applyCurveIntent, renderCurveValues } from './curveEngine'
import { constrainSeriesValue, editSeries } from './curveEngine'

export function curveSemanticPosition(step: PaletteStep, mode: 'light' | 'dark'): number {
  return mode === 'dark' ? 1 - step.position : step.position
}

export function captureCurve(palette: Palette, type: CurveType, name: string, now = Date.now()): SavedCurve {
  const mode = palette.activeMode
  const steps = mode === 'dark' ? (palette.modes.dark ?? palette.modes.light) : palette.modes.light
  const baseHue = steps.find((step) => step.isBase)?.oklch.h ?? 0
  return {
    id: crypto.randomUUID(),
    name,
    type,
    strategy: palette.curveStrategies?.[type] ?? 'anchored',
    points: steps
      .map((step) => ({ id: crypto.randomUUID(), position: curveSemanticPosition(step, mode), value: curvePlotValue(step, baseHue, type) }))
      .sort((a, b) => a.position - b.position),
    createdAt: now,
    updatedAt: now,
  }
}

export function sampleCurve(curve: SavedCurve, position: number): number {
  const points = [...curve.points].sort((a, b) => a.position - b.position)
  if (position <= points[0]!.position) return points[0]!.value
  if (position >= points[points.length - 1]!.position) return points[points.length - 1]!.value
  for (let index = 1; index < points.length; index++) {
    const right = points[index]!
    if (right.position < position) continue
    const left = points[index - 1]!
    const span = Math.max(1e-9, right.position - left.position)
    const progress = (position - left.position) / span
    return left.value + (right.value - left.value) * progress
  }
  return points[points.length - 1]!.value
}

export function sampleCurveCorrection(points: CurveCorrectionPoint[] | undefined, position: number): number {
  if (!points || points.length === 0) return 0
  const ordered = [...points].sort((a, b) => a.position - b.position)
  if (ordered.length === 1) return Math.abs(ordered[0]!.position - position) <= 0.001 ? ordered[0]!.value : 0
  if (position <= ordered[0]!.position) return ordered[0]!.value
  if (position >= ordered[ordered.length - 1]!.position) return ordered[ordered.length - 1]!.value
  for (let index = 1; index < ordered.length; index++) {
    const right = ordered[index]!
    if (right.position < position) continue
    const left = ordered[index - 1]!
    const progress = (position - left.position) / Math.max(1e-9, right.position - left.position)
    return left.value + (right.value - left.value) * progress
  }
  return 0
}

function applyToMode(
  steps: PaletteStep[],
  mode: 'light' | 'dark',
  curve: SavedCurve,
  backgrounds: { light: string; dark: string },
  corrections?: CurveCorrectionPoint[],
): PaletteStep[] {
  const baseHue = steps.find((step) => step.isBase)?.oklch.h ?? 0
  const requested = steps.map((step) => {
    const position = curveSemanticPosition(step, mode)
    return Math.max(0, Math.min(1, sampleCurve(curve, position) + sampleCurveCorrection(corrections, position)))
  })
  const intents = applyCurveIntent(steps, curve.type, requested, curve.strategy ?? 'anchored')
  return steps.map((step, index) => {
    if ((curve.strategy ?? 'anchored') === 'anchored' && step.isBase) return step
    const curveValues = intents[index]!
    const { hex, oklch } = renderCurveValues(curveValues, baseHue)
    return {
      ...step,
      hex,
      curveValues,
      oklch,
      contrast: {
        onLight: contrastRatio(hex, backgrounds.light),
        onDark: contrastRatio(hex, backgrounds.dark),
      },
    }
  })
}

export interface RealizedCurveSample {
  stepId: string
  label: number
  semanticPosition: number
  requestedValue: number
  realizedValue: number
  isBase: boolean
}

export interface RealizedCurvePreview {
  palette: Palette
  samples: RealizedCurveSample[]
}

export function constrainCurveSampleValue(
  type: CurveType,
  samples: RealizedCurveSample[],
  semanticPosition: number,
  value: number,
): number {
  const clamped = Math.max(0, Math.min(1, value))
  if (type !== 'lightness') return clamped
  const ordered = [...samples].sort((a, b) => a.semanticPosition - b.semanticPosition)
  let index = 0
  let nearestDistance = Infinity
  ordered.forEach((sample, candidateIndex) => {
    const distance = Math.abs(sample.semanticPosition - semanticPosition)
    if (distance < nearestDistance) {
      nearestDistance = distance
      index = candidateIndex
    }
  })
  const minimum = ordered[index + 1] ? ordered[index + 1]!.realizedValue + 0.001 : 0.001
  const maximum = ordered[index - 1] ? ordered[index - 1]!.realizedValue - 0.001 : 0.999
  if (minimum > maximum) return ordered[index]?.realizedValue ?? clamped
  return Math.max(minimum, Math.min(maximum, clamped))
}

export function realizeCurvePreview(
  palette: Palette,
  curve: SavedCurve,
  backgrounds: { light: string; dark: string },
): RealizedCurvePreview {
  const realizedPalette = applySavedCurve(palette, curve, backgrounds)
  const steps = realizedPalette.activeMode === 'dark'
    ? (realizedPalette.modes.dark ?? realizedPalette.modes.light)
    : realizedPalette.modes.light
  const baseHue = steps.find((step) => step.isBase)?.oklch.h ?? 0
  return {
    palette: realizedPalette,
    samples: steps.map((step) => {
      const position = curveSemanticPosition(step, realizedPalette.activeMode)
      const corrections = palette.curveBindings?.[curve.type] === curve.id
        ? palette.curveCorrections?.[curve.type]?.[realizedPalette.activeMode]
        : undefined
      return {
        stepId: step.id,
        label: step.label,
        semanticPosition: position,
        requestedValue: Math.max(0, Math.min(1, sampleCurve(curve, position) + sampleCurveCorrection(corrections, position))),
        realizedValue: curvePlotValue(step, baseHue, curve.type),
        isBase: step.isBase,
      }
    }),
  }
}

export function applySavedCurve(
  palette: Palette,
  curve: SavedCurve,
  backgrounds: { light: string; dark: string },
): Palette {
  const preservesCorrections = palette.curveBindings?.[curve.type] === curve.id
  const correctionModes = preservesCorrections ? palette.curveCorrections?.[curve.type] : undefined
  const curveCorrections = { ...palette.curveCorrections }
  if (!preservesCorrections) delete curveCorrections[curve.type]
  return {
    ...palette,
    preset: 'manual',
    curveStrategies: { ...palette.curveStrategies, [curve.type]: curve.strategy ?? 'anchored' },
    curveBindings: { ...palette.curveBindings, [curve.type]: curve.id },
    curveCorrections: Object.keys(curveCorrections).length > 0 ? curveCorrections : undefined,
    modes: {
      light: applyToMode(palette.modes.light, 'light', curve, backgrounds, correctionModes?.light),
      dark: palette.modes.dark ? applyToMode(palette.modes.dark, 'dark', curve, backgrounds, correctionModes?.dark) : null,
    },
  }
}

export function updateCurveAtPaletteStep(
  curve: SavedCurve,
  palette: Palette,
  stepId: string,
  value: number,
  now = Date.now(),
): SavedCurve {
  const steps = palette.activeMode === 'dark' ? (palette.modes.dark ?? palette.modes.light) : palette.modes.light
  const step = steps.find((candidate) => candidate.id === stepId)
  if (!step) return curve
  const position = curveSemanticPosition(step, palette.activeMode)
  return updateCurveAtPosition(curve, position, value, now)
}

export function updateCurveAtPosition(
  curve: SavedCurve,
  position: number,
  value: number,
  now = Date.now(),
): SavedCurve {
  const clampedPosition = Math.max(0, Math.min(1, position))
  const clampedValue = Math.max(0, Math.min(1, value))
  const points = [...curve.points]
  let nearestIndex = 0
  let nearestDistance = Infinity
  points.forEach((point, index) => {
    const distance = Math.abs(point.position - clampedPosition)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = index
    }
  })
  if (nearestDistance <= 0.001) {
    const targetId = points[nearestIndex]!.id
    return updateCurvePointById({ ...curve, points }, targetId, clampedValue, now)
  } else {
    points.push({ id: crypto.randomUUID(), position: clampedPosition, value: clampedValue })
  }
  points.sort((a, b) => a.position - b.position)
  const inserted = points.find((point) => point.position === clampedPosition)!
  return updateCurvePointById({ ...curve, points }, inserted.id, clampedValue, now)
}

export function constrainSavedCurvePointValue(curve: SavedCurve, pointId: string, value: number): number {
  const ordered = [...curve.points].sort((a, b) => a.position - b.position)
  const index = ordered.findIndex((point) => point.id === pointId)
  if (index < 0) return Math.max(0, Math.min(1, value))
  const anchors = new Set([0, ordered.length - 1])
  return constrainSeriesValue(ordered.map((point) => point.value), index, value, curve.strategy ?? 'anchored', anchors)
}

export function updateCurvePointById(
  curve: SavedCurve,
  pointId: string,
  value: number,
  now = Date.now(),
): SavedCurve {
  const point = curve.points.find((candidate) => candidate.id === pointId)
  if (!point) return curve
  const ordered = [...curve.points].sort((a, b) => a.position - b.position)
  const index = ordered.findIndex((candidate) => candidate.id === pointId)
  const anchors = new Set([0, ordered.length - 1])
  const nextValues = editSeries(ordered.map((candidate) => candidate.value), index, value, curve.strategy ?? 'anchored', anchors)
  if (nextValues.every((nextValue, candidateIndex) => nextValue === ordered[candidateIndex]!.value)) return curve
  const valuesById = new Map(ordered.map((candidate, candidateIndex) => [candidate.id, nextValues[candidateIndex]!]))
  return {
    ...curve,
    points: curve.points.map((candidate) => ({ ...candidate, value: valuesById.get(candidate.id)! })),
    updatedAt: now,
  }
}

function easingValue(preset: CurveShapePreset, t: number): number {
  if (preset === 'ease-in') return t * t
  if (preset === 'ease-out') return 1 - (1 - t) ** 2
  if (preset === 'ease-in-out') return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
  if (preset === 'smoothstep') return t * t * (3 - 2 * t)
  return t
}

function normalizedPeak(t: number, peak: number): number {
  if (t <= peak) return Math.sin((t / peak) * Math.PI / 2)
  return Math.sin(((1 - t) / (1 - peak)) * Math.PI / 2)
}

export function curveShapePresets(type: CurveType): CurveShapePreset[] {
  return type === 'chroma'
    ? ['bell', 'early-peak', 'late-peak', 'soft-ends']
    : ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'smoothstep']
}

export function applyCurveShapePreset(
  curve: SavedCurve,
  preset: CurveShapePreset,
  now = Date.now(),
): SavedCurve {
  const points = [...curve.points].sort((a, b) => a.position - b.position)
  const firstPosition = points[0]!.position
  const span = Math.max(1e-9, points[points.length - 1]!.position - firstPosition)
  const values = points.map((point) => point.value)
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const range = maximum - minimum
  const start = points[0]!.value
  const end = points[points.length - 1]!.value

  const reshaped = points.map((point) => {
    const t = Math.max(0, Math.min(1, (point.position - firstPosition) / span))
    let value: number
    if (preset === 'bell' || preset === 'early-peak' || preset === 'late-peak' || preset === 'soft-ends') {
      const peak = preset === 'early-peak' ? 0.35 : preset === 'late-peak' ? 0.65 : 0.5
      const shape = preset === 'soft-ends'
        ? Math.sin(Math.PI * t) ** 0.65
        : normalizedPeak(t, peak)
      value = minimum + range * shape
    } else {
      value = start + (end - start) * easingValue(preset, t)
    }
    return { ...point, value: Math.max(0, Math.min(1, value)) }
  })

  return { ...curve, points: reshaped, updatedAt: now }
}
