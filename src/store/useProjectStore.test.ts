import { beforeEach, describe, expect, it } from 'vitest'
import type { PaletteStep, Project } from '../types/project'
import { getActiveSteps } from '../types/project'
import { generatePaletteForMode } from '../lib/generatePalette'
import { curvePlotValue } from '../lib/curveChart'
import { curveSemanticPosition, sampleCurve } from '../lib/savedCurves'
import { useProjectStore } from './useProjectStore'

const backgrounds = { light: '#ffffff', dark: '#000000' }

function projectWithCustomDarkPalette(): Project {
  const palette = generatePaletteForMode(
    '#684b28',
    14,
    backgrounds,
    [],
    'dark',
    { lightest: 0.96, darkest: 0.18 },
    {
      lightnessDistribution: 'perceptual',
      lightChromaFalloff: 0.75,
      darkChromaFalloff: 0.75,
    },
  )
  return {
    id: 'project',
    name: 'Project',
    stepCount: 14,
    backgrounds,
    lightnessRange: { lightest: 0.96, darkest: 0.12 },
    lightnessDistribution: 'linear',
    palettes: [palette],
    createdAt: 1,
    updatedAt: 1,
  }
}

function expectMonotonic(steps: PaletteStep[], mode: 'light' | 'dark') {
  for (let i = 1; i < steps.length; i++) {
    if (mode === 'dark') expect(steps[i]!.oklch.l).toBeGreaterThan(steps[i - 1]!.oklch.l)
    else expect(steps[i]!.oklch.l).toBeLessThan(steps[i - 1]!.oklch.l)
  }
}

function expectExactBases(project: Project) {
  for (const palette of project.palettes) {
    for (const steps of [palette.modes.light, palette.modes.dark].filter(Boolean) as PaletteStep[][]) {
      const bases = steps.filter((step) => step.isBase)
      expect(bases).toHaveLength(1)
      expect(bases[0]!.hex).toBe(palette.baseHex)
    }
  }
}

describe('palette mutation sequences', () => {
  beforeEach(() => {
    const project = projectWithCustomDarkPalette()
    useProjectStore.setState({
      activeProject: project,
      libraryProjects: [project],
      isDirty: false,
      pendingDeletion: null,
      saveBlocked: false,
      curveHistoryPast: [],
      curveHistoryFuture: [],
      curvePreview: null,
      curvePreviewKind: null,
    })
  })

  it('inserts from the palette-specific curve without creating an anchor', () => {
    const before = useProjectStore.getState().activeProject!
    const palette = before.palettes[0]!
    const steps = getActiveSteps(palette)
    const oldIds = new Set(steps.map((step) => step.id))

    useProjectStore.getState().insertStep(palette.id, steps[8]!.label, steps[9]!.label)

    const updated = useProjectStore.getState().activeProject!
    const updatedPalette = updated.palettes[0]!
    const updatedSteps = getActiveSteps(updatedPalette)
    const inserted = updatedSteps.filter((step) => !oldIds.has(step.id))
    const expected = getActiveSteps(generatePaletteForMode(
      palette.baseHex,
      updatedSteps.length - 1,
      backgrounds,
      [],
      'dark',
      { lightest: 0.96, darkest: 0.18 },
      {
        lightnessDistribution: 'perceptual',
        lightChromaFalloff: 0.75,
        darkChromaFalloff: 0.75,
      },
    ))
    expect(updatedSteps).toHaveLength(steps.length + 1)
    expect(inserted).toHaveLength(1)
    expect(inserted[0]!.locked).toBe(false)
    expect(updatedSteps.map((step) => step.hex)).toEqual(expected.map((step) => step.hex))
    expect(updatedPalette.lightnessRange).toEqual({ lightest: 0.96, darkest: 0.18 })
    expect(updatedPalette.lightnessDistribution).toBe('perceptual')
    expectMonotonic(updatedSteps, 'dark')
    expectExactBases(updated)
  })

  it('fits from a locked step, clears obsolete anchors, and preserves the palette step count', () => {
    const before = useProjectStore.getState().activeProject!
    const palette = before.palettes[0]!
    const steps = getActiveSteps(palette)
    const selected = steps[9]!
    useProjectStore.getState().lockStep(palette.id, selected.label)

    const lockedProject = useProjectStore.getState().activeProject!
    const lockedPalette = lockedProject.palettes[0]!
    const lockedStep = getActiveSteps(lockedPalette).find((step) => step.id === selected.id)!
    useProjectStore.getState().recalibratePaletteToStep(lockedPalette.id, lockedStep.label)

    const updated = useProjectStore.getState().activeProject!
    const updatedPalette = updated.palettes[0]!
    expect(updatedPalette.baseHex).toBe(lockedStep.hex)
    expect(updatedPalette.modes.light).toHaveLength(palette.modes.light.length)
    expect(updatedPalette.modes.dark).toHaveLength(palette.modes.dark!.length)
    expect(updatedPalette.modes.light.every((step) => !step.locked)).toBe(true)
    expect(updatedPalette.modes.dark!.every((step) => !step.locked)).toBe(true)
    expectMonotonic(updatedPalette.modes.light, 'light')
    expectMonotonic(updatedPalette.modes.dark!, 'dark')
    expectExactBases(updated)
  })

  it('materializes project-wide curve changes into each palette configuration', () => {
    useProjectStore.getState().updateLightnessRange({ lightest: 0.9, darkest: 0.2 })

    const updated = useProjectStore.getState().activeProject!
    const palette = updated.palettes[0]!
    expect(palette.preset).toBe('manual')
    expect(palette.lightnessRange).toEqual({ lightest: 0.9, darkest: 0.2 })
    expect(palette.lightnessDistribution).toBe('perceptual')
    expectMonotonic(palette.modes.light, 'light')
    expectMonotonic(palette.modes.dark!, 'dark')
    expectExactBases(updated)
  })

  it('returns to a smooth curve after an insert/delete cycle', () => {
    const before = useProjectStore.getState().activeProject!
    const palette = before.palettes[0]!
    const steps = getActiveSteps(palette)
    const oldIds = new Set(steps.map((step) => step.id))
    useProjectStore.getState().insertStep(palette.id, steps[7]!.label, steps[8]!.label)

    const insertedPalette = useProjectStore.getState().activeProject!.palettes[0]!
    const insertedSteps = getActiveSteps(insertedPalette)
    const inserted = insertedSteps.find((step) => !oldIds.has(step.id))!
    useProjectStore.getState().deleteStep(insertedPalette.id, inserted.label)

    const updated = useProjectStore.getState().activeProject!
    const updatedPalette = updated.palettes[0]!
    const updatedSteps = getActiveSteps(updatedPalette)
    expect(updatedSteps).toHaveLength(steps.length)
    expect([...oldIds].every((id) => updatedSteps.some((step) => step.id === id))).toBe(true)
    expectMonotonic(updatedSteps, 'dark')
    expectExactBases(updated)
  })

  it('clears old anchors when applying a new starting recipe', () => {
    const before = useProjectStore.getState().activeProject!
    const palette = before.palettes[0]!
    const step = getActiveSteps(palette)[8]!
    useProjectStore.getState().lockStep(palette.id, step.label)
    useProjectStore.getState().applyPalettePreset(palette.id, 'muted')

    const updated = useProjectStore.getState().activeProject!
    const updatedPalette = updated.palettes[0]!
    expect(updatedPalette.preset).toBe('muted')
    expect(updatedPalette.modes.light.every((candidate) => !candidate.locked)).toBe(true)
    expect(updatedPalette.modes.dark!.every((candidate) => !candidate.locked)).toBe(true)
    expectMonotonic(updatedPalette.modes.light, 'light')
    expectMonotonic(updatedPalette.modes.dark!, 'dark')
    expectExactBases(updated)
  })

  it('edits one unbound chart point without recalibrating its neighbors', () => {
    const palette = useProjectStore.getState().activeProject!.palettes[0]!
    const before = getActiveSteps(palette)
    const index = before.findIndex((step) => !step.isBase && step.oklch.c >= 0.01)
    const step = before[index]!
    const baseHue = before.find((candidate) => candidate.isBase)!.oklch.h
    const chromaBefore = curvePlotValue(step, baseHue, 'chroma')
    const current = curvePlotValue(step, baseHue, 'hue')
    const next = current > 0.5 ? 0.1 : 0.9

    useProjectStore.getState().updateCurveStep(palette.id, step.label, 'hue', next)

    const after = getActiveSteps(useProjectStore.getState().activeProject!.palettes[0]!)
    expect(after[index]!.hex).not.toBe(before[index]!.hex)
    expect(curvePlotValue(after[index]!, baseHue, 'chroma')).toBeCloseTo(chromaBefore, 6)
    expect(after.filter((_, candidateIndex) => candidateIndex !== index).map((candidate) => candidate.hex))
      .toEqual(before.filter((_, candidateIndex) => candidateIndex !== index).map((candidate) => candidate.hex))
  })

  it('allows an unbound lightness point to cross its neighbors without moving them', () => {
    const palette = useProjectStore.getState().activeProject!.palettes[0]!
    const before = getActiveSteps(palette)
    const index = before.findIndex((step, candidateIndex) => !step.isBase && candidateIndex > 0 && candidateIndex < before.length - 1)
    const step = before[index]!
    const neighborHexes = [before[index - 1]!.hex, before[index + 1]!.hex]

    useProjectStore.getState().updateCurveStep(palette.id, step.label, 'lightness', 1)

    const after = getActiveSteps(useProjectStore.getState().activeProject!.palettes[0]!)
    expect(after[index]!.oklch.l).toBeCloseTo(1, 2)
    expect([after[index - 1]!.hex, after[index + 1]!.hex]).toEqual(neighborHexes)
  })

  it('keeps curve intent exact across sequential drag-equivalent channel edits', () => {
    const palette = useProjectStore.getState().activeProject!.palettes[0]!
    const step = getActiveSteps(palette).find((candidate) => !candidate.isBase)!

    useProjectStore.getState().updateCurveStep(palette.id, step.label, 'lightness', 0.413257)
    useProjectStore.getState().updateCurveStep(palette.id, step.label, 'hue', 0.827311)

    const edited = getActiveSteps(useProjectStore.getState().activeProject!.palettes[0]!)
      .find((candidate) => candidate.id === step.id)!
    expect(edited.curveValues.lightness).toBe(0.413257)
    expect(edited.curveValues.hue).toBe(0.827311)
    expect(edited.hex).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('applies free, monotonic, smooth, and anchored interaction strategies explicitly', () => {
    let palette = useProjectStore.getState().activeProject!.palettes[0]!
    let steps = getActiveSteps(palette)
    const index = steps.findIndex((step, candidateIndex) => !step.isBase && candidateIndex > 1 && candidateIndex < steps.length - 2)

    useProjectStore.getState().updateCurveStrategy(palette.id, 'lightness', 'monotonic')
    useProjectStore.getState().updateCurveStep(palette.id, steps[index]!.label, 'lightness', 1)
    palette = useProjectStore.getState().activeProject!.palettes[0]!
    steps = getActiveSteps(palette)
    const neighborValues = [steps[index - 1]!.curveValues.lightness, steps[index + 1]!.curveValues.lightness]
    expect(steps[index]!.curveValues.lightness).toBeGreaterThanOrEqual(Math.min(...neighborValues))
    expect(steps[index]!.curveValues.lightness).toBeLessThanOrEqual(Math.max(...neighborValues))

    useProjectStore.getState().updateCurveStrategy(palette.id, 'chroma', 'smooth')
    const neighborBefore = steps[index - 1]!.curveValues.chroma
    useProjectStore.getState().updateCurveStep(palette.id, steps[index]!.label, 'chroma', 0)
    palette = useProjectStore.getState().activeProject!.palettes[0]!
    steps = getActiveSteps(palette)
    expect(steps[index - 1]!.curveValues.chroma).not.toBe(neighborBefore)

    const base = steps.find((step) => step.isBase)!
    useProjectStore.getState().updateCurveStrategy(palette.id, 'lightness', 'anchored')
    useProjectStore.getState().updateCurveStep(palette.id, base.label, 'lightness', 0)
    const anchoredBase = getActiveSteps(useProjectStore.getState().activeProject!.palettes[0]!).find((step) => step.isBase)!
    expect(anchoredBase.curveValues.lightness).toBe(base.curveValues.lightness)

    useProjectStore.getState().updateCurveStrategy(palette.id, 'lightness', 'free')
    useProjectStore.getState().updateCurveStep(palette.id, base.label, 'lightness', 0.7)
    const freeBase = getActiveSteps(useProjectStore.getState().activeProject!.palettes[0]!).find((step) => step.isBase)!
    expect(freeBase.curveValues.lightness).toBeCloseTo(0.7, 2)
    expect(freeBase.hex).not.toBe(base.hex)
  })

  it('edits a base curve point and keeps the base synchronized across modes', () => {
    const palette = useProjectStore.getState().activeProject!.palettes[0]!
    const base = getActiveSteps(palette).find((step) => step.isBase)!
    const beforeHex = palette.baseHex

    useProjectStore.getState().updateCurveStep(palette.id, base.label, 'lightness', 0.7)

    const updated = useProjectStore.getState().activeProject!
    expect(updated.palettes[0]!.baseHex).not.toBe(beforeHex)
    expect(updated.palettes[0]!.modes.light.find((step) => step.isBase)!.oklch.l).toBeCloseTo(0.7, 2)
    expect(updated.palettes[0]!.modes.light.find((step) => step.isBase)!.curveValues.lightness).toBeCloseTo(0.7, 2)
    expectExactBases(updated)
  })

  it('keeps palette edits local while isolated curve edits propagate to linked palettes', () => {
    const project = useProjectStore.getState().activeProject!
    const source = project.palettes[0]!
    const target = generatePaletteForMode('#2563eb', 14, backgrounds, [], 'dark')
    useProjectStore.setState({ activeProject: { ...project, palettes: [source, target] } })

    const curveId = useProjectStore.getState().saveCurve(source.id, 'chroma', 'Shared chroma')!
    useProjectStore.getState().applySavedCurve([target.id], curveId)
    const linked = useProjectStore.getState().activeProject!
    const linkedSource = linked.palettes.find((palette) => palette.id === source.id)!
    const linkedTarget = linked.palettes.find((palette) => palette.id === target.id)!
    const targetBefore = getActiveSteps(linkedTarget)[4]!.hex
    const sourceNeighborBefore = getActiveSteps(linkedSource)[3]!.hex
    const targetNeighborBefore = getActiveSteps(linkedTarget)[3]!.hex
    const sourceStep = getActiveSteps(linkedSource)[4]!
    const sharedBefore = linked.savedCurves!.find((curve) => curve.id === curveId)!

    useProjectStore.getState().updateCurveStep(linkedSource.id, sourceStep.label, 'chroma', 0.08)

    const locallyEdited = useProjectStore.getState().activeProject!
    const editedSource = locallyEdited.palettes.find((palette) => palette.id === source.id)!
    expect(locallyEdited.savedCurves!.find((curve) => curve.id === curveId)!.points).toEqual(sharedBefore.points)
    expect(editedSource.curveCorrections?.chroma?.dark.length).toBe(getActiveSteps(editedSource).length)
    expect(getActiveSteps(locallyEdited.palettes.find((palette) => palette.id === target.id)!)[4]!.hex).toBe(targetBefore)
    expect(getActiveSteps(editedSource)[3]!.hex).toBe(sourceNeighborBefore)
    expect(getActiveSteps(locallyEdited.palettes.find((palette) => palette.id === target.id)!)[3]!.hex).toBe(targetNeighborBefore)

    const position = curveSemanticPosition(sourceStep, linkedSource.activeMode)
    const targetBeforeSharedEdit = getActiveSteps(locallyEdited.palettes.find((palette) => palette.id === target.id)!)[4]!.hex
    useProjectStore.getState().updateSavedCurveAtPosition(curveId, position, Math.max(0, sampleCurve(sharedBefore, position) - 0.12))
    const sharedEdited = useProjectStore.getState().activeProject!
    expect(getActiveSteps(sharedEdited.palettes.find((palette) => palette.id === target.id)!)[4]!.hex).not.toBe(targetBeforeSharedEdit)
    expect(sharedEdited.palettes.find((palette) => palette.id === source.id)!.curveCorrections?.chroma?.dark.length).toBeGreaterThan(0)
  })

  it('saves a curve set as three linked typed curves', () => {
    const palette = useProjectStore.getState().activeProject!.palettes[0]!
    const setId = useProjectStore.getState().saveCurveSet(palette.id, 'Product ramp')!
    const updated = useProjectStore.getState().activeProject!
    const curveSet = updated.curveSets?.find((candidate) => candidate.id === setId)!
    const updatedPalette = updated.palettes[0]!

    expect(updated.savedCurves).toHaveLength(3)
    expect(curveSet.name).toBe('Product ramp')
    expect(updatedPalette.curveBindings).toEqual(curveSet.curveIds)
  })

  it('keeps a saved curve linked when a linked step is edited by hex', () => {
    const palette = useProjectStore.getState().activeProject!.palettes[0]!
    const curveId = useProjectStore.getState().saveCurve(palette.id, 'lightness', 'Shared lightness')!
    const step = getActiveSteps(palette).find((candidate) => !candidate.isBase)!

    useProjectStore.getState().updateStepHex(palette.id, step.label, '#3f4854')

    const updated = useProjectStore.getState().activeProject!.palettes[0]!
    expect(updated.curveBindings?.lightness).toBe(curveId)
    expect(updated.curveCorrections?.lightness?.dark.length).toBe(getActiveSteps(updated).length)
    expect(updated.curveCorrections?.lightness?.dark.some((point) => Math.abs(point.value) > 0.0001)).toBe(true)
  })

  it('preserves local corrections when a linked palette changes step count', () => {
    const palette = useProjectStore.getState().activeProject!.palettes[0]!
    const curveId = useProjectStore.getState().saveCurve(palette.id, 'chroma', 'Shared chroma')!
    const step = getActiveSteps(palette)[4]!
    useProjectStore.getState().updateCurveStep(palette.id, step.label, 'chroma', 0.08)

    useProjectStore.getState().updatePaletteStepCount(palette.id, 10)

    const updated = useProjectStore.getState().activeProject!.palettes[0]!
    expect(updated.curveBindings?.chroma).toBe(curveId)
    expect(updated.curveCorrections?.chroma?.dark.some((point) => Math.abs(point.value) > 0.0001)).toBe(true)
    expect(getActiveSteps(updated)).toHaveLength(11)
  })

  it('keeps local corrections separate between light and dark modes', () => {
    const palette = useProjectStore.getState().activeProject!.palettes[0]!
    const curveId = useProjectStore.getState().saveCurve(palette.id, 'chroma', 'Mode-aware chroma')!
    const darkStep = getActiveSteps(palette)[4]!
    useProjectStore.getState().updateCurveStep(palette.id, darkStep.label, 'chroma', 0.08)
    useProjectStore.getState().switchPaletteMode(palette.id, 'light')

    let updated = useProjectStore.getState().activeProject!.palettes[0]!
    expect(updated.curveBindings?.chroma).toBe(curveId)
    expect(updated.curveCorrections?.chroma?.dark.some((point) => Math.abs(point.value) > 0.0001)).toBe(true)
    expect(updated.curveCorrections?.chroma?.light).toEqual([])

    const lightStep = getActiveSteps(updated).find((candidate) => !candidate.isBase)!
    useProjectStore.getState().updateCurveStep(updated.id, lightStep.label, 'chroma', 0.12)
    updated = useProjectStore.getState().activeProject!.palettes[0]!
    expect(updated.curveCorrections?.chroma?.light.some((point) => Math.abs(point.value) > 0.0001)).toBe(true)
  })

  it('applies a saved curve to multiple palettes in one operation', () => {
    const project = useProjectStore.getState().activeProject!
    const source = project.palettes[0]!
    const blue = generatePaletteForMode('#2563eb', 14, backgrounds, [], 'light')
    const red = generatePaletteForMode('#dc2626', 14, backgrounds, [], 'light')
    useProjectStore.setState({ activeProject: { ...project, palettes: [source, blue, red] } })

    const curveId = useProjectStore.getState().saveCurve(source.id, 'lightness', 'Shared lightness')!
    useProjectStore.getState().applySavedCurve([blue.id, red.id], curveId)

    const updated = useProjectStore.getState().activeProject!
    expect(updated.palettes.find((palette) => palette.id === blue.id)!.curveBindings?.lightness).toBe(curveId)
    expect(updated.palettes.find((palette) => palette.id === red.id)!.curveBindings?.lightness).toBe(curveId)
    expect(updated.palettes.find((palette) => palette.id === source.id)!.curveBindings?.lightness).toBe(curveId)
  })

  it('edits an isolated curve, reshapes it, and can detach a linked color', () => {
    const palette = useProjectStore.getState().activeProject!.palettes[0]!
    const curveId = useProjectStore.getState().saveCurve(palette.id, 'lightness', 'Editable')!
    const before = useProjectStore.getState().activeProject!.savedCurves!.find((curve) => curve.id === curveId)!
    const backgroundBefore = getActiveSteps(useProjectStore.getState().activeProject!.palettes[0]!).map((step) => step.hex)
    const neighborBefore = before.points[3]!.value

    useProjectStore.getState().updateSavedCurveAtPosition(curveId, before.points[4]!.position, 0.42)
    const edited = useProjectStore.getState().activeProject!.savedCurves!.find((curve) => curve.id === curveId)!
    expect(edited.points[4]!.value).toBeCloseTo(0.42)
    expect(edited.points[3]!.value).toBe(neighborBefore)
    expect(getActiveSteps(useProjectStore.getState().activeProject!.palettes[0]!).map((step) => step.hex)).not.toEqual(backgroundBefore)

    const committedValue = edited.points[5]!.value
    const previewValue = (edited.points[5]!.value + edited.points[6]!.value) / 2
    useProjectStore.getState().previewSavedCurvePoint(curveId, edited.points[5]!.id, previewValue)
    expect(useProjectStore.getState().curvePreviewKind).toBe('drag')
    expect(useProjectStore.getState().curvePreview!.points[5]!.value).toBeCloseTo(previewValue)
    expect(useProjectStore.getState().curvePreview!.points[4]!.value).toBeCloseTo(edited.points[4]!.value)
    expect(useProjectStore.getState().activeProject!.savedCurves!.find((curve) => curve.id === curveId)!.points[5]!.value).toBe(committedValue)
    useProjectStore.getState().commitCurvePreview()
    expect(useProjectStore.getState().activeProject!.savedCurves!.find((curve) => curve.id === curveId)!.points[5]!.value).toBeCloseTo(previewValue)

    useProjectStore.getState().previewCurveShapePreset(curveId, 'ease-in-out')
    const preview = useProjectStore.getState().curvePreview!
    const committedBackgroundBefore = getActiveSteps(useProjectStore.getState().activeProject!.palettes[0]!).map((step) => step.hex)
    expect(preview.points[4]!.value).not.toBeCloseTo(0.42)
    expect(useProjectStore.getState().activeProject!.savedCurves!.find((curve) => curve.id === curveId)!.points[4]!.value).toBeCloseTo(0.42)

    useProjectStore.getState().cancelCurvePreview()
    expect(useProjectStore.getState().curvePreview).toBeNull()
    useProjectStore.getState().previewCurveShapePreset(curveId, 'ease-in-out')
    useProjectStore.getState().commitCurvePreview()
    const reshaped = useProjectStore.getState().activeProject!.savedCurves!.find((curve) => curve.id === curveId)!
    expect(reshaped.points[4]!.value).not.toBeCloseTo(0.42)
    expect(getActiveSteps(useProjectStore.getState().activeProject!.palettes[0]!).map((step) => step.hex)).not.toEqual(committedBackgroundBefore)

    useProjectStore.getState().undoCurveEdit()
    expect(useProjectStore.getState().activeProject!.savedCurves!.find((curve) => curve.id === curveId)!.points[4]!.value).toBeCloseTo(0.42)
    useProjectStore.getState().redoCurveEdit()
    expect(useProjectStore.getState().activeProject!.savedCurves!.find((curve) => curve.id === curveId)!.points[4]!.value).toBeCloseTo(reshaped.points[4]!.value)

    useProjectStore.getState().detachSavedCurve(palette.id, 'lightness')
    expect(useProjectStore.getState().activeProject!.palettes[0]!.curveBindings?.lightness).toBeUndefined()
  })
})
