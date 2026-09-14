import { describe, expect, it } from 'vitest'
import type { Palette, PalettePreset, Project } from '../types/project'
import { getActiveSteps, PALETTE_PRESETS } from '../types/project'
import {
  generateModeSteps,
  generatePalette,
  generatePaletteForMode,
  paletteGenOpts,
  regeneratePalette,
  relabelPalette,
  validateBasePosition,
} from './generatePalette'
import { deserializeProject, serializeProject } from './serialization'
import { hexToOklch, maxChromaInGamut, oklchToHex } from './color'

const backgrounds = { light: '#ffffff', dark: '#000000' }
const seeds = ['#808080', '#ff0000', '#ffcc00', '#22c55e', '#3b82f6', '#7c3aed', '#ec4899']

describe('palette generation invariants', () => {
  it.each(['linear', 'perceptual'] as const)('keeps %s ramps monotonic and preserves one exact base', (distribution) => {
    for (const seed of seeds) {
      for (const mode of ['light', 'dark'] as const) {
        const steps = generateModeSteps(seed, 10, backgrounds, mode, { lightest: 0.97, darkest: 0.12 }, {
          envelopeExponent: 0.75,
          lightnessDistribution: distribution,
        })
        for (let i = 1; i < steps.length; i++) {
          if (mode === 'light') expect(steps[i]!.oklch.l).toBeLessThan(steps[i - 1]!.oklch.l)
          else expect(steps[i]!.oklch.l).toBeGreaterThan(steps[i - 1]!.oklch.l)
        }
        expect(steps.filter((step) => step.isBase)).toHaveLength(1)
        expect(steps.find((step) => step.isBase)?.hex).toBe(seed)
      }
    }
  })

  it('preserves a tinted neutral instead of replacing it with a threshold tint', () => {
    const seed = '#777b80'
    const steps = generateModeSteps(seed, 10, backgrounds, 'light')
    const base = steps.find((step) => step.isBase)!
    expect(base.hex).toBe(seed)
    expect(base.oklch.c).toBeGreaterThan(0)
    expect(Math.max(...steps.map((step) => step.oklch.c))).toBeCloseTo(base.oklch.c, 2)
  })

  it.each(['light', 'dark'] as const)('retains a visible tinted-neutral identity at the light end in %s mode', (mode) => {
    const seed = oklchToHex(0.56, 0.022, 55)
    const [, baseC] = hexToOklch(seed)
    const steps = generateModeSteps(seed, 10, backgrounds, mode, { lightest: 0.98, darkest: 0.12 })
    const lightest = mode === 'light' ? steps[0]! : steps[steps.length - 1]!

    expect(lightest.oklch.c).toBeGreaterThan(baseC * 0.45)
    for (let i = 1; i < steps.length; i++) {
      if (mode === 'light') expect(steps[i]!.oklch.l).toBeLessThan(steps[i - 1]!.oklch.l)
      else expect(steps[i]!.oklch.l).toBeGreaterThan(steps[i - 1]!.oklch.l)
    }
  })

  it('preserves a very subtle tint in the light ramp when the palette is created in dark mode', () => {
    const seed = oklchToHex(0.56, 0.005, 55)
    const palette = generatePaletteForMode(
      seed,
      10,
      backgrounds,
      [],
      'dark',
      { lightest: 0.98, darkest: 0.12 },
    )
    const lightest = palette.modes.light[0]!

    expect(hexToOklch(seed)[1]).toBeGreaterThan(0.003)
    expect(lightest.oklch.c).toBeGreaterThan(0.0015)
    expect(lightest.hex.slice(1, 3) === lightest.hex.slice(3, 5) && lightest.hex.slice(3, 5) === lightest.hex.slice(5, 7)).toBe(false)
  })

  it('retains gamut-relative colorfulness outside the neon-prone green spectrum', () => {
    for (let hue = 0; hue < 360; hue += 30) {
      if (hue >= 90 && hue <= 150) continue
      const baseL = 0.58
      const baseC = maxChromaInGamut(baseL, hue) * 0.68
      const seed = oklchToHex(baseL, baseC, hue)
      const [, actualBaseC, actualBaseH] = hexToOklch(seed)
      const baseOccupancy = actualBaseC / maxChromaInGamut(baseL, actualBaseH)
      const lightest = generateModeSteps(
        seed,
        10,
        backgrounds,
        'light',
        { lightest: 0.96, darkest: 0.12 },
      )[0]!
      const lightOccupancy = lightest.oklch.c / maxChromaInGamut(lightest.oklch.l, lightest.oklch.h)

      expect(lightOccupancy).toBeGreaterThan(baseOccupancy * 0.45)
    }
  })

  it.each(['light', 'dark'] as const)('limits neon-prone chromatic greens at the light end in %s mode', (mode) => {
    for (const hue of [95, 115, 135, 155]) {
      const baseL = 0.58
      const seed = oklchToHex(baseL, maxChromaInGamut(baseL, hue) * 0.72, hue)
      const steps = generateModeSteps(seed, 10, backgrounds, mode, { lightest: 0.96, darkest: 0.12 })
      const lightest = mode === 'light' ? steps[0]! : steps[steps.length - 1]!
      const occupancy = lightest.oklch.c / maxChromaInGamut(lightest.oklch.l, lightest.oklch.h)

      expect(
        occupancy,
        `${mode} hue ${hue}: L=${lightest.oklch.l} C=${lightest.oklch.c} H=${lightest.oklch.h}`,
      ).toBeLessThan(0.38)
    }
  })

  it('keeps a green tinted-neutral visible without applying the neon ceiling', () => {
    const seed = oklchToHex(0.56, 0.022, 130)
    const [, baseC] = hexToOklch(seed)
    const lightest = generateModeSteps(
      seed,
      10,
      backgrounds,
      'light',
      { lightest: 0.98, darkest: 0.12 },
    )[0]!

    expect(lightest.oklch.c).toBeGreaterThan(baseC * 0.45)
  })

  it('does not invent a tint for a true neutral', () => {
    const steps = generateModeSteps('#777777', 10, backgrounds, 'light', { lightest: 0.98, darkest: 0.12 })
    expect(steps[0]!.oklch.c).toBeLessThan(0.003)
  })

  it('creates a newly added dark-mode palette with darkest-to-lightest active steps', () => {
    const palette = generatePaletteForMode('#0f766e', 10, backgrounds, [], 'dark')
    const steps = getActiveSteps(palette)

    expect(palette.activeMode).toBe('dark')
    expect(palette.modes.dark).not.toBeNull()
    expect(steps[0]!.oklch.l).toBeLessThan(steps[steps.length - 1]!.oklch.l)
  })

  it('exposes independent falloff and hue controls through the shared curve', () => {
    const baseline = generateModeSteps('#3b82f6', 10, backgrounds, 'light')
    const adjusted = generateModeSteps('#3b82f6', 10, backgrounds, 'light', undefined, {
      lightChromaFalloff: 1.6,
      darkChromaFalloff: 0.4,
      lightHueShift: 15,
      darkHueShift: -15,
    })
    expect(adjusted.find((step) => step.isBase)?.hex).toBe('#3b82f6')
    expect(adjusted[1]!.oklch.c).toBeLessThan(baseline[1]!.oklch.c)
    expect(Math.abs(adjusted[0]!.oklch.h - baseline[0]!.oklch.h)).toBeGreaterThan(5)
    expect(Math.abs(adjusted[adjusted.length - 1]!.oklch.h - baseline[baseline.length - 1]!.oklch.h)).toBeGreaterThan(5)
  })

  it.each(['0-10', '0-100', '0-1000'] as const)('keeps %s labels unique and inside their range', (scale) => {
    const palette = generatePalette('#3b82f6', 20, backgrounds, [])
    const labeled = relabelPalette(palette, { lightest: 0.97, darkest: 0.12 }, scale)
    const labels = labeled.modes.light.map((step) => step.label)
    const max = scale === '0-10' ? 10 : scale === '0-100' ? 100 : 1000
    expect(labels[0]).toBe(0)
    expect(labels[labels.length - 1]).toBe(max)
    expect(new Set(labels).size).toBe(labels.length)
    expect(labels.every((label) => label >= 0 && label <= max)).toBe(true)
  })

  it('keeps edited anchors and stable unique IDs while changing step count', () => {
    const palette = generatePalette('#3b82f6', 10, backgrounds, [])
    const anchor = palette.modes.light[3]!
    const anchorHex = oklchToHex(anchor.oklch.l, anchor.oklch.c * 0.55, anchor.oklch.h + 3)
    const edited: Palette = {
      ...palette,
      modes: {
        ...palette.modes,
        light: palette.modes.light.map((step) => step.id === anchor.id
          ? { ...step, hex: anchorHex, locked: true }
          : step),
      },
    }
    const regenerated = regeneratePalette(edited, 14, backgrounds)
    expect(regenerated.modes.light.some((step) => step.id === anchor.id && step.hex === anchorHex)).toBe(true)
    expect(new Set(regenerated.modes.light.map((step) => step.id)).size).toBe(regenerated.modes.light.length)
  })

  it('releases a conflicting anchor instead of allowing a lightness reversal', () => {
    const palette = generatePalette('#3b82f6', 10, backgrounds, [])
    const anchor = palette.modes.light[3]!
    const edited: Palette = {
      ...palette,
      modes: {
        ...palette.modes,
        light: palette.modes.light.map((step) => step.id === anchor.id
          ? { ...step, hex: '#111827', locked: true }
          : step),
      },
    }

    const regenerated = regeneratePalette(edited, 10, backgrounds)
    const steps = regenerated.modes.light
    expect(steps.find((step) => step.id === anchor.id)?.locked).toBe(false)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.oklch.l).toBeLessThan(steps[i - 1]!.oklch.l)
    }
  })

  it.each(['light', 'dark'] as const)('keeps the exact base immutable with %s-mode anchors', (mode) => {
    const light = generatePalette('#b77900', 14, backgrounds, [], { lightest: 0.96, darkest: 0.18 }, {
      lightnessDistribution: 'perceptual',
    })
    const palette = mode === 'dark'
      ? generatePaletteForMode('#b77900', 14, backgrounds, [], 'dark', { lightest: 0.96, darkest: 0.18 }, {
        lightnessDistribution: 'perceptual',
      })
      : light
    const steps = getActiveSteps(palette)
    const baseIndex = steps.findIndex((step) => step.isBase)
    const anchorIndex = baseIndex > 2 ? baseIndex - 2 : baseIndex + 2
    const anchor = steps[anchorIndex]!
    const anchorHex = oklchToHex(anchor.oklch.l, anchor.oklch.c * 0.7, anchor.oklch.h + 2)
    const edited: Palette = {
      ...palette,
      modes: {
        ...palette.modes,
        [mode]: steps.map((step, index) => index === anchorIndex
          ? { ...step, hex: anchorHex, locked: true }
          : step),
      },
    }

    const regenerated = regeneratePalette(edited, 14, backgrounds, { lightest: 0.96, darkest: 0.18 }, {
      lightnessDistribution: 'perceptual',
    })
    const regeneratedSteps = mode === 'dark' ? regenerated.modes.dark! : regenerated.modes.light
    const bases = regeneratedSteps.filter((step) => step.isBase)
    expect(bases).toHaveLength(1)
    expect(bases[0]!.hex).toBe(palette.baseHex)
  })

  it('repairs the Gold 2 adjacent-anchor plateau without changing the fitted base', () => {
    const palette = generatePaletteForMode(
      '#684b28',
      14,
      backgrounds,
      [],
      'dark',
      { lightest: 0.96, darkest: 0.18 },
      { lightnessDistribution: 'perceptual' },
    )
    const badAnchorId = palette.modes.dark![9]!.id
    const corrupted: Palette = {
      ...palette,
      modes: {
        ...palette.modes,
        dark: palette.modes.dark!.map((step, index) => {
          if (index === 8) return { ...step, hex: '#90775b', locked: true }
          if (index === 9) return { ...step, hex: '#957650', locked: true }
          return step
        }),
      },
    }

    const repaired = regeneratePalette(
      corrupted,
      14,
      backgrounds,
      { lightest: 0.96, darkest: 0.18 },
      { lightnessDistribution: 'perceptual' },
    )
    const steps = repaired.modes.dark!
    expect(steps.find((step) => step.id === badAnchorId)?.locked).toBe(false)
    expect(steps.filter((step) => step.isBase)).toHaveLength(1)
    expect(steps.find((step) => step.isBase)?.hex).toBe('#684b28')
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.oklch.l).toBeGreaterThan(steps[i - 1]!.oklch.l)
    }
  })

  it('validates base endpoints according to the active mode ordering', () => {
    const range = { lightest: 0.96, darkest: 0.12 }
    expect(validateBasePosition('#fafafa', 10, range, {}, 'light')).toBe('too-light')
    expect(validateBasePosition('#fafafa', 10, range, {}, 'dark')).toBe('too-light')
    expect(validateBasePosition('#080808', 10, range, {}, 'light')).toBe('too-dark')
    expect(validateBasePosition('#080808', 10, range, {}, 'dark')).toBe('too-dark')
  })

  it.each([
    ['#777b80', 'light'],
    ['#777b80', 'dark'],
    ['#b77900', 'light'],
    ['#b77900', 'dark'],
    ['#3b82f6', 'light'],
    ['#3b82f6', 'dark'],
  ] as const)('preserves compatible anchors on both sides of %s in %s mode', (seed, mode) => {
    const range = { lightest: 0.96, darkest: 0.14 }
    const opts = {
      lightnessDistribution: 'perceptual' as const,
      lightChromaFalloff: 0.65,
      darkChromaFalloff: 1.05,
      lightHueShift: 4,
      darkHueShift: -5,
    }
    const palette = generatePaletteForMode(seed, 10, backgrounds, [], mode, range, opts)
    const steps = getActiveSteps(palette)
    const baseIndex = steps.findIndex((step) => step.isBase)
    const anchorIndexes = [baseIndex - 2, baseIndex + 2].filter((index) => index > 0 && index < steps.length - 1)
    const anchors = anchorIndexes.map((index) => {
      const step = steps[index]!
      return {
        id: step.id,
        hex: oklchToHex(step.oklch.l, step.oklch.c * 0.7, step.oklch.h + 2),
      }
    })
    const edited: Palette = {
      ...palette,
      modes: {
        ...palette.modes,
        [mode]: steps.map((step) => {
          const anchor = anchors.find((candidate) => candidate.id === step.id)
          return anchor ? { ...step, hex: anchor.hex, locked: true } : step
        }),
      },
    }

    const regenerated = regeneratePalette(edited, 14, backgrounds, range, opts)
    const result = mode === 'dark' ? regenerated.modes.dark! : regenerated.modes.light
    for (const anchor of anchors) {
      expect(result.some((step) => step.id === anchor.id && step.hex === anchor.hex && step.locked)).toBe(true)
    }
    expect(result.filter((step) => step.isBase)).toHaveLength(1)
    expect(result.find((step) => step.isBase)?.hex).toBe(seed)
    for (let i = 1; i < result.length; i++) {
      if (mode === 'dark') expect(result[i]!.oklch.l).toBeGreaterThan(result[i - 1]!.oklch.l)
      else expect(result[i]!.oklch.l).toBeLessThan(result[i - 1]!.oklch.l)
    }
  })
})

describe('palette persistence', () => {
  it('retains recipe controls and stable step identity', () => {
    const palette = generatePalette('#3b82f6', 10, backgrounds, [])
    const preset: PalettePreset = 'manual'
    const project: Project = {
      id: 'project',
      name: 'Project',
      stepCount: 10,
      backgrounds,
      lightnessRange: { lightest: 0.97, darkest: 0.12 },
      palettes: [{
        ...palette,
        preset,
        lightnessRange: { lightest: 0.91, darkest: 0.19 },
        envelopeExponent: 1.2,
        lightChromaFalloff: 1.1,
        darkChromaFalloff: 0.8,
        lightHueShift: 4,
        darkHueShift: -6,
        lightnessDistribution: 'perceptual',
      }],
      createdAt: 1,
      updatedAt: 1,
    }
    const restored = deserializeProject(serializeProject(project), project.id)
    expect(restored.palettes[0]?.preset).toBe('manual')
    expect(restored.palettes[0]?.lightnessRange).toEqual({ lightest: 0.91, darkest: 0.19 })
    expect(restored.palettes[0]?.lightChromaFalloff).toBe(1.1)
    expect(restored.palettes[0]?.darkHueShift).toBe(-6)
    expect(restored.palettes[0]?.modes.light[0]?.id).toBe(palette.modes.light[0]?.id)
  })

  it('treats named presets as recipes for the shared curve engine', () => {
    const palette = generatePalette('#3b82f6', 10, backgrounds, [])
    for (const preset of Object.keys(PALETTE_PRESETS) as Exclude<PalettePreset, 'manual'>[]) {
      const project = {
        palettes: [{ ...palette, preset }],
        lightnessRange: { lightest: 0.96, darkest: 0.12 },
      } as Project
      expect(paletteGenOpts(project.palettes[0]!, project).lRange).toEqual(PALETTE_PRESETS[preset].lightnessRange)
    }
  })
})
