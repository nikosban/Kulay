import { describe, expect, it } from 'vitest'
import type { Project } from '../types/project'
import { getActiveSteps } from '../types/project'
import { generatePaletteForMode } from './generatePalette'
import { applyCurveShapePreset, applySavedCurve, captureCurve, constrainCurveSampleValue, curveShapePresets, realizeCurvePreview, sampleCurve, updateCurveAtPaletteStep, updateCurveAtPosition, updateCurvePointById } from './savedCurves'
import { curvePlotValue } from './curveChart'
import { deserializeProject, serializeProject } from './serialization'

const backgrounds = { light: '#ffffff', dark: '#000000' }

describe('saved curves', () => {
  it('captures dark mode in semantic light-to-dark order', () => {
    const palette = generatePaletteForMode('#b77900', 10, backgrounds, [], 'dark')
    const curve = captureCurve(palette, 'lightness', 'Lightness')

    expect(curve.points[0]!.position).toBe(0)
    expect(curve.points[curve.points.length - 1]!.position).toBe(1)
    expect(curve.points[0]!.value).toBeGreaterThan(curve.points[curve.points.length - 1]!.value)
  })

  it('interpolates between saved points', () => {
    const palette = generatePaletteForMode('#3b82f6', 2, backgrounds, [], 'light')
    const curve = captureCurve(palette, 'hue', 'Hue')
    curve.points = [{ id: 'left', position: 0, value: 0.2 }, { id: 'right', position: 1, value: 0.8 }]

    expect(sampleCurve(curve, 0.5)).toBeCloseTo(0.5)
  })

  it('applies a curve without replacing the target base color', () => {
    const source = generatePaletteForMode('#b77900', 10, backgrounds, [], 'light')
    const target = generatePaletteForMode('#3b82f6', 10, backgrounds, [], 'dark')
    const curve = captureCurve(source, 'chroma', 'Chroma')
    const applied = applySavedCurve(target, curve, backgrounds)

    expect(applied.curveBindings?.chroma).toBe(curve.id)
    expect(getActiveSteps(applied).find((step) => step.isBase)?.hex).toBe(target.baseHex)
    expect(applied.modes.light.filter((step) => !step.isBase).every((step) => !step.locked)).toBe(true)
    expect(applied.modes.dark!.filter((step) => !step.isBase).every((step) => !step.locked)).toBe(true)
  })

  it('updates only the selected saved sample when one point moves', () => {
    const palette = generatePaletteForMode('#b77900', 10, backgrounds, [], 'light')
    const curve = captureCurve(palette, 'chroma', 'Chroma')
    const steps = getActiveSteps(palette)
    const index = 4
    const neighborBefore = curve.points[index - 1]!.value
    const updated = updateCurveAtPaletteStep(curve, palette, steps[index]!.id, 0.05)

    expect(updated.points[index]!.value).toBeCloseTo(0.05)
    expect(updated.points[index - 1]!.value).toBe(neighborBefore)
    expect(updated.points[index - 3]!.value).toBeCloseTo(curve.points[index - 3]!.value)
  })

  it('updates a point by semantic position even when its source array is unsorted', () => {
    const palette = generatePaletteForMode('#b77900', 3, backgrounds, [], 'light')
    const curve = captureCurve(palette, 'chroma', 'Chroma')
    const target = curve.points[1]!
    const neighbor = curve.points[0]!
    curve.points = [curve.points[2]!, target, neighbor, ...curve.points.slice(3)]

    const updated = updateCurveAtPosition(curve, target.position, 0.07)

    expect(updated.points.find((point) => point.id === target.id)?.value).toBeCloseTo(0.07)
    expect(updated.points.find((point) => point.id === neighbor.id)?.value).toBe(neighbor.value)
  })

  it('updates exactly one saved chroma control point by stable identity', () => {
    const palette = generatePaletteForMode('#0f766e', 10, backgrounds, [], 'dark')
    const curve = captureCurve(palette, 'chroma', 'Chroma')
    const target = curve.points[5]!
    const before = new Map(curve.points.map((point) => [point.id, point.value]))

    const updated = updateCurvePointById(curve, target.id, 0.12)

    updated.points.forEach((point) => {
      if (point.id === target.id) expect(point.value).toBeCloseTo(0.12)
      else expect(point.value).toBe(before.get(point.id))
    })
  })

  it('lets one saved lightness control cross its neighbors without changing them', () => {
    const palette = generatePaletteForMode('#0f766e', 10, backgrounds, [], 'dark')
    const curve = captureCurve(palette, 'lightness', 'Lightness')
    const target = curve.points[5]!
    const updated = updateCurvePointById(curve, target.id, 1)

    expect(updated.points[5]!.value).toBe(1)
    expect(updated.points.filter((point) => point.id !== target.id).map((point) => point.value))
      .toEqual(curve.points.filter((point) => point.id !== target.id).map((point) => point.value))
  })

  it('realizes dark-mode samples in the same visual order as their background columns', () => {
    const palette = generatePaletteForMode('#0f766e', 10, backgrounds, [], 'dark')
    const curve = captureCurve(palette, 'lightness', 'Lightness')
    const preview = realizeCurvePreview(palette, curve, backgrounds)
    const steps = getActiveSteps(preview.palette)

    expect(preview.samples.map((sample) => sample.stepId)).toEqual(steps.map((step) => step.id))
    const last = preview.samples[preview.samples.length - 1]!
    expect(preview.samples[0]!.semanticPosition).toBeGreaterThan(last.semanticPosition)
    expect(preview.samples[0]!.realizedValue).toBeLessThan(last.realizedValue)
  })

  it('reports the exact realized channel value painted in every preview column', () => {
    const palette = generatePaletteForMode('#a855f7', 10, backgrounds, [], 'dark')
    const curve = captureCurve(palette, 'chroma', 'Chroma')
    const preview = realizeCurvePreview(palette, curve, backgrounds)
    const steps = getActiveSteps(preview.palette)
    const baseHue = steps.find((step) => step.isBase)!.oklch.h

    preview.samples.forEach((sample, index) => {
      expect(sample.realizedValue).toBeCloseTo(curvePlotValue(steps[index]!, baseHue, curve.type), 8)
    })
  })

  it('clamps a lightness edit between realized neighbors so they do not need to move', () => {
    const palette = generatePaletteForMode('#16a34a', 10, backgrounds, [], 'dark')
    const curve = captureCurve(palette, 'lightness', 'Lightness')
    const before = realizeCurvePreview(palette, curve, backgrounds)
    const target = before.samples.find((sample, index) => index > 1 && index < before.samples.length - 2 && !sample.isBase)!
    const constrained = constrainCurveSampleValue(curve.type, before.samples, target.semanticPosition, 0)
    const updated = updateCurveAtPosition(curve, target.semanticPosition, constrained)
    const after = realizeCurvePreview(palette, updated, backgrounds)

    before.samples.forEach((sample) => {
      if (sample.stepId === target.stepId) return
      expect(after.samples.find((candidate) => candidate.stepId === sample.stepId)!.realizedValue).toBeCloseTo(sample.realizedValue, 5)
    })
  })

  it('keeps the reference base as an explicit anchor in the realized preview', () => {
    const palette = generatePaletteForMode('#2563eb', 10, backgrounds, [], 'light')
    const curve = captureCurve(palette, 'lightness', 'Lightness')
    const base = getActiveSteps(palette).find((step) => step.isBase)!
    const moved = updateCurveAtPosition(curve, base.position, 0.05)
    const preview = realizeCurvePreview(palette, moved, backgrounds)
    const baseSample = preview.samples.find((sample) => sample.isBase)!

    expect(baseSample.realizedValue).toBeCloseTo(base.oklch.l, 5)
    expect(baseSample.requestedValue).toBeCloseTo(0.05)
  })

  it('applies mathematical presets without changing curve positions', () => {
    const palette = generatePaletteForMode('#b77900', 10, backgrounds, [], 'light')
    const curve = captureCurve(palette, 'lightness', 'Lightness')
    const reshaped = applyCurveShapePreset(curve, 'ease-in', 2)

    expect(reshaped.points.map((point) => point.position)).toEqual(curve.points.map((point) => point.position))
    expect(reshaped.points[0]!.value).toBeCloseTo(curve.points[0]!.value)
    expect(reshaped.points[reshaped.points.length - 1]!.value).toBeCloseTo(curve.points[curve.points.length - 1]!.value)
    expect(reshaped.points[4]!.value).not.toBeCloseTo(curve.points[4]!.value)
    expect(reshaped.updatedAt).toBe(2)
    expect(curveShapePresets('chroma')).toContain('bell')
  })

  it('persists saved curves, presets, and palette bindings', () => {
    const palette = generatePaletteForMode('#b77900', 10, backgrounds, [], 'light')
    const lightness = captureCurve(palette, 'lightness', 'Lightness', 1)
    const chroma = captureCurve(palette, 'chroma', 'Chroma', 1)
    const hue = captureCurve(palette, 'hue', 'Hue', 1)
    const curveIds = { lightness: lightness.id, chroma: chroma.id, hue: hue.id }
    const project: Project = {
      id: 'project', name: 'Project', stepCount: 10, backgrounds,
      lightnessRange: { lightest: 0.97, darkest: 0.12 },
      palettes: [{
        ...palette,
        curveBindings: curveIds,
        curveCorrections: {
          lightness: {
            light: [{ id: 'correction', position: 0.4, value: -0.05 }],
            dark: [],
          },
        },
      }],
      savedCurves: [lightness, chroma, hue],
      curveSets: [{ id: 'set', name: 'Set', curveIds, createdAt: 1, updatedAt: 1 }],
      createdAt: 1, updatedAt: 1,
    }

    const restored = deserializeProject(serializeProject(project), project.id)
    expect(restored.savedCurves).toHaveLength(3)
    expect(restored.curveSets?.[0]?.curveIds).toEqual(curveIds)
    expect(restored.palettes[0]?.curveBindings).toEqual(curveIds)
    expect(restored.palettes[0]?.curveCorrections?.lightness?.light[0]?.value).toBeCloseTo(-0.05)
  })

  it('migrates legacy three-curve presets into curve sets', () => {
    const palette = generatePaletteForMode('#b77900', 10, backgrounds, [], 'light')
    const curves = (['lightness', 'chroma', 'hue'] as const).map((type) => captureCurve(palette, type, type, 1))
    const curveIds = Object.fromEntries(curves.map((curve) => [curve.type, curve.id]))
    const legacy = {
      id: 'legacy', name: 'Legacy', stepCount: 10, backgrounds,
      lightnessRange: { lightest: 0.97, darkest: 0.12 }, palettes: [palette],
      savedCurves: curves,
      curvePresets: [{ id: 'old-preset', name: 'Old bundle', curveIds, createdAt: 1, updatedAt: 1 }],
      createdAt: 1, updatedAt: 1,
    }

    const restored = deserializeProject(JSON.stringify(legacy), legacy.id)
    expect(restored.curveSets?.[0]?.name).toBe('Old bundle')
    expect('curvePresets' in restored).toBe(false)
  })

  it('sorts legacy curve points and assigns stable point ids', () => {
    const palette = generatePaletteForMode('#b77900', 2, backgrounds, [], 'light')
    const legacy = {
      id: 'legacy-points', name: 'Legacy points', stepCount: 2, backgrounds,
      lightnessRange: { lightest: 0.97, darkest: 0.12 }, palettes: [palette],
      savedCurves: [{
        id: 'curve', name: 'Curve', type: 'lightness',
        points: [{ position: 1, value: 0.1 }, { position: 0, value: 0.9 }],
        createdAt: 1, updatedAt: 1,
      }],
      createdAt: 1, updatedAt: 1,
    }

    const restored = deserializeProject(JSON.stringify(legacy), legacy.id)
    expect(restored.savedCurves![0]!.points.map((point) => point.position)).toEqual([0, 1])
    expect(restored.savedCurves![0]!.points.every((point) => point.id.length > 0)).toBe(true)
  })

  it('migrates the legacy ±20° hue encoding without changing its intended offset', () => {
    const palette = generatePaletteForMode('#ef4444', 2, backgrounds, [], 'light')
    palette.modes.light[0]!.curveValues.hue = 0.75 // legacy value: +10°
    const legacy = {
      id: 'legacy-hue', name: 'Legacy hue', stepCount: 2, backgrounds,
      lightnessRange: { lightest: 0.97, darkest: 0.12 }, palettes: [palette],
      savedCurves: [{
        id: 'hue-curve', name: 'Hue', type: 'hue',
        points: [{ id: 'a', position: 0, value: 0.25 }, { id: 'b', position: 1, value: 0.75 }],
        createdAt: 1, updatedAt: 1,
      }],
      createdAt: 1, updatedAt: 1,
    }

    const restored = deserializeProject(JSON.stringify(legacy), legacy.id)
    expect(restored.curveDataVersion).toBe(2)
    expect(restored.palettes[0]!.modes.light[0]!.curveValues.hue).toBeCloseTo(0.5 + 10 / 360)
    expect(restored.savedCurves![0]!.points[0]!.value).toBeCloseTo(0.5 - 10 / 360)
    expect(restored.savedCurves![0]!.points[1]!.value).toBeCloseTo(0.5 + 10 / 360)
  })
})
