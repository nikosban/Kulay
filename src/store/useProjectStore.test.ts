import { beforeEach, describe, expect, it } from 'vitest'
import type { PaletteStep, Project } from '../types/project'
import { getActiveSteps } from '../types/project'
import { generatePaletteForMode } from '../lib/generatePalette'
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
})
