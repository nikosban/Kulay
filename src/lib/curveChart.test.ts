import { describe, expect, it } from 'vitest'
import { hexToOklch, maxChromaInGamut } from './color'
import { curveColumnCenter, curveDisplayValue, curvePlotValue, curveStepHex, curveStepOklch, isCurveChannelEditable, parseCurveInputValue, savedCurvePointX, shortestHueOffset } from './curveChart'
import { generatePaletteForMode } from './generatePalette'
import { getActiveSteps } from '../types/project'

const backgrounds = { light: '#ffffff', dark: '#000000' }

describe('curve chart transforms', () => {
  it('centers endpoint samples inside their color columns', () => {
    expect(curveColumnCenter(0, 10, 1000)).toBe(50)
    expect(curveColumnCenter(9, 10, 1000)).toBe(950)
  })

  it('aligns saved curve endpoints to column centers and reverses only their visual x order in dark mode', () => {
    expect(savedCurvePointX(0, 10, 1000, false)).toBe(50)
    expect(savedCurvePointX(1, 10, 1000, false)).toBe(950)
    expect(savedCurvePointX(0, 10, 1000, true)).toBe(950)
    expect(savedCurvePointX(1, 10, 1000, true)).toBe(50)
  })

  it('parses curve values with either decimal separator', () => {
    expect(parseCurveInputValue('0.625')).toBe(0.625)
    expect(parseCurveInputValue('0,625')).toBe(0.625)
    expect(parseCurveInputValue('')).toBeNull()
    expect(parseCurveInputValue('not a number')).toBeNull()
  })

  it('unwraps hue around zero', () => {
    expect(shortestHueOffset(2, 358)).toBe(4)
    expect(shortestHueOffset(358, 2)).toBe(-4)
  })

  it('keeps hue controls editable for effectively neutral steps', () => {
    const palette = generatePaletteForMode('#777777', 10, backgrounds, [], 'light')
    const step = getActiveSteps(palette)[0]!

    expect(Number.isFinite(curvePlotValue(step, 0, 'hue'))).toBe(true)
    expect(curveDisplayValue(step, 0, 'hue')).toMatch(/^ΔH /)
    expect(isCurveChannelEditable(step, 'hue')).toBe(true)
  })

  it('plots chroma as gamut occupancy and maps it back safely', () => {
    const palette = generatePaletteForMode('#16a34a', 10, backgrounds, [], 'light')
    const steps = getActiveSteps(palette)
    const index = 4
    const hex = curveStepHex(steps, index, steps.find((step) => step.isBase)!.oklch.h, 'chroma', 0.55)
    const [l, c, h] = hexToOklch(hex)

    expect(c / maxChromaInGamut(l, h)).toBeCloseTo(0.55, 1)
    expect(curvePlotValue(steps[index]!, palette.modes.light.find((step) => step.isBase)!.oklch.h, 'chroma')).toBeGreaterThanOrEqual(0)
  })

  it('preserves chroma occupancy when hue changes', () => {
    const palette = generatePaletteForMode('#16a34a', 10, backgrounds, [], 'light')
    const steps = getActiveSteps(palette)
    const index = 4
    const baseHue = steps.find((step) => step.isBase)!.oklch.h
    const before = curvePlotValue(steps[index]!, baseHue, 'chroma')
    const [l, c, h] = curveStepOklch(steps, index, baseHue, 'hue', 0.85)
    const edited = { ...steps[index]!, oklch: { l, c, h } }

    expect(curvePlotValue(edited, baseHue, 'chroma')).toBeCloseTo(before, 6)
  })

  it('allows hue edits across the full color wheel', () => {
    const palette = generatePaletteForMode('#ef4444', 10, backgrounds, [], 'light')
    const steps = getActiveSteps(palette)
    const index = 4
    const baseHue = steps.find((step) => step.isBase)!.oklch.h
    const [, , shiftedHue] = curveStepOklch(steps, index, baseHue, 'hue', 0.75)

    expect(Math.abs(shortestHueOffset(shiftedHue, baseHue))).toBeCloseTo(90, 5)
  })

  it.each(['light', 'dark'] as const)('allows a dragged lightness point to cross its neighbors in %s mode', (mode) => {
    const palette = generatePaletteForMode('#3b82f6', 10, backgrounds, [], mode)
    const steps = getActiveSteps(palette)
    const index = 4
    const requested = mode === 'light' ? 0 : 1
    const [l] = hexToOklch(curveStepHex(steps, index, steps[index]!.oklch.h, 'lightness', requested))
    const neighborLightnesses = [steps[index - 1]!.oklch.l, steps[index + 1]!.oklch.l]

    if (requested === 0) expect(l).toBeLessThan(Math.min(...neighborLightnesses))
    else expect(l).toBeGreaterThan(Math.max(...neighborLightnesses))
  })
})
