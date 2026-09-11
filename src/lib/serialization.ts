import type { Project, Palette, PaletteStep } from '../types/project'
import { DEFAULT_LIGHTNESS_RANGE } from '../types/project'
import { hexToOklch } from './color'

export class CorruptedProjectError extends Error {
  constructor(id: string) {
    super(`Project ${id} could not be deserialized`)
    this.name = 'CorruptedProjectError'
  }
}

function isValidProject(obj: unknown): obj is Project {
  if (typeof obj !== 'object' || obj === null) return false
  const p = obj as Record<string, unknown>
  return (
    typeof p.id === 'string' &&
    typeof p.name === 'string' &&
    typeof p.stepCount === 'number' &&
    typeof p.backgrounds === 'object' &&
    p.backgrounds !== null &&
    typeof (p.backgrounds as Record<string, unknown>).light === 'string' &&
    typeof (p.backgrounds as Record<string, unknown>).dark === 'string' &&
    Array.isArray(p.palettes) &&
    typeof p.createdAt === 'number' &&
    typeof p.updatedAt === 'number'
  )
}

function migrateStep(step: unknown, index: number, count: number): PaletteStep {
  const s = step as Record<string, unknown>
  const hex = typeof s.hex === 'string' ? s.hex : '#808080'
  const [l, c, h] = hexToOklch(hex)
  return {
    id: typeof s.id === 'string' ? s.id : crypto.randomUUID(),
    position: typeof s.position === 'number' ? s.position : index / Math.max(1, count - 1),
    label: typeof s.label === 'number' ? s.label : 0,
    hex,
    isBase: typeof s.isBase === 'boolean' ? s.isBase : false,
    locked: typeof s.locked === 'boolean' ? s.locked : false,
    oklch: (s.oklch && typeof s.oklch === 'object') ? s.oklch as { l: number; c: number; h: number } : { l, c, h },
    contrast: (s.contrast && typeof s.contrast === 'object')
      ? s.contrast as { onLight: number; onDark: number }
      : { onLight: 1, onDark: 1 },
  }
}

function migratePalette(raw: unknown): Palette {
  const p = raw as Record<string, unknown>
  const id = typeof p.id === 'string' ? p.id : crypto.randomUUID()
  const name = typeof p.name === 'string' ? p.name : 'Untitled'
  const baseHex = typeof p.baseHex === 'string' ? p.baseHex : '#808080'
  const activeMode: 'light' | 'dark' = p.activeMode === 'dark' ? 'dark' : 'light'

  // Old format: palette has `steps` directly
  if (Array.isArray(p.steps) && !p.modes) {
    const steps = p.steps as unknown[]
    return {
      id, name, baseHex, activeMode: 'light',
      modes: { light: steps.map((step, index) => migrateStep(step, index, steps.length)), dark: null },
    }
  }

  // New format with `modes`
  const modes = p.modes as Record<string, unknown> | undefined
  const rawLightSteps = Array.isArray(modes?.light) ? modes.light as unknown[] : []
  const rawDarkSteps = Array.isArray(modes?.dark) ? modes.dark as unknown[] : null
  const lightSteps = rawLightSteps.map((step, index) => migrateStep(step, index, rawLightSteps.length))
  const darkSteps = rawDarkSteps?.map((step, index) => migrateStep(step, index, rawDarkSteps.length)) ?? null

  return {
    id, name, baseHex, activeMode,
    preset: p.preset as Palette['preset'],
    lightnessRange: p.lightnessRange as Palette['lightnessRange'],
    envelopeExponent: typeof p.envelopeExponent === 'number' ? p.envelopeExponent : undefined,
    lightChromaFalloff: typeof p.lightChromaFalloff === 'number' ? p.lightChromaFalloff : undefined,
    darkChromaFalloff: typeof p.darkChromaFalloff === 'number' ? p.darkChromaFalloff : undefined,
    lightHueShift: typeof p.lightHueShift === 'number' ? p.lightHueShift : undefined,
    darkHueShift: typeof p.darkHueShift === 'number' ? p.darkHueShift : undefined,
    lightnessDistribution: p.lightnessDistribution === 'perceptual' ? 'perceptual' : p.lightnessDistribution === 'linear' ? 'linear' : undefined,
    modes: { light: lightSteps, dark: darkSteps },
  }
}

function migrateProject(project: Project): Project {
  return {
    ...project,
    lightnessRange: project.lightnessRange ?? DEFAULT_LIGHTNESS_RANGE,
    palettes: (project.palettes as unknown[]).map(migratePalette),
  }
}

export function serializeProject(project: Project): string {
  return JSON.stringify(project)
}

export function deserializeProject(raw: string, id: string): Project {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new CorruptedProjectError(id)
  }
  if (!isValidProject(parsed)) throw new CorruptedProjectError(id)
  return migrateProject(parsed)
}
