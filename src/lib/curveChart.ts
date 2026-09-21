import type { CurveConstraintStrategy, CurveType, PaletteStep } from '../types/project'
import { constrainCurveValue, curveValue, hueCurveValueToDegrees, renderCurveValues } from './curveEngine'

export type CurveChannel = CurveType

export function curveColumnCenter(index: number, count: number, width: number): number {
  if (count <= 0) return 0
  return ((Math.max(0, Math.min(count - 1, index)) + 0.5) / count) * width
}

export function savedCurvePointX(position: number, columnCount: number, width: number, darkMode: boolean): number {
  if (columnCount <= 0) return Math.max(0, Math.min(width, position * width))
  const columnWidth = width / columnCount
  const visualPosition = darkMode ? 1 - position : position
  return columnWidth / 2 + Math.max(0, Math.min(1, visualPosition)) * (width - columnWidth)
}

export function parseCurveInputValue(rawValue: string): number | null {
  const normalized = rawValue.trim().replace(',', '.')
  if (normalized === '') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

export { shortestHueOffset } from './curveEngine'

export function curvePlotValue(step: PaletteStep, baseHue: number, channel: CurveChannel): number {
  void baseHue
  return curveValue(step, channel)
}

export function curveDisplayValue(step: PaletteStep, baseHue: number, channel: CurveChannel): string {
  void baseHue
  if (channel === 'lightness') return `L ${step.curveValues.lightness.toFixed(3)}`
  if (channel === 'chroma') return `${Math.round(step.curveValues.chroma * 100)}% gamut`
  const offset = hueCurveValueToDegrees(step.curveValues.hue)
  return `ΔH ${offset >= 0 ? '+' : ''}${offset.toFixed(1)}°`
}

export function isCurveChannelEditable(_step: PaletteStep, _channel: CurveChannel): boolean {
  return true
}

export function constrainCurveStepValue(
  steps: PaletteStep[],
  stepIndex: number,
  channel: CurveChannel,
  rawPlotValue: number,
  strategy: CurveConstraintStrategy = 'free',
): number {
  return constrainCurveValue(steps, stepIndex, channel, rawPlotValue, strategy)
}

export function curveStepHex(
  steps: PaletteStep[],
  stepIndex: number,
  baseHue: number,
  channel: CurveChannel,
  rawPlotValue: number,
  strategy: CurveConstraintStrategy = 'free',
): string {
  const values = { ...steps[stepIndex]!.curveValues, [channel]: constrainCurveStepValue(steps, stepIndex, channel, rawPlotValue, strategy) }
  return renderCurveValues(values, baseHue).hex
}

export function curveStepOklch(
  steps: PaletteStep[],
  stepIndex: number,
  baseHue: number,
  channel: CurveChannel,
  rawPlotValue: number,
  strategy: CurveConstraintStrategy = 'free',
): [number, number, number] {
  const values = { ...steps[stepIndex]!.curveValues, [channel]: constrainCurveStepValue(steps, stepIndex, channel, rawPlotValue, strategy) }
  const { oklch } = renderCurveValues(values, baseHue)
  return [oklch.l, oklch.c, oklch.h]
}
