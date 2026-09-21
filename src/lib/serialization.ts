import type { Project, Palette, PaletteStep, SavedCurve, CurveSetDefinition, CurveType, CurveCorrectionModes, CurveConstraintStrategy } from '../types/project'
import { DEFAULT_LIGHTNESS_RANGE } from '../types/project'
import { hexToOklch } from './color'
import { curveValuesFromOklch, migrateLegacyHueCurveValue } from './curveEngine'

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

function migrateStep(step: unknown, index: number, count: number, baseHue: number, legacyHueEncoding: boolean): PaletteStep {
  const s = step as Record<string, unknown>
  const hex = typeof s.hex === 'string' ? s.hex : '#808080'
  const [l, c, h] = hexToOklch(hex)
  const storedCurveValues = s.curveValues && typeof s.curveValues === 'object'
    ? s.curveValues as PaletteStep['curveValues']
    : null
  return {
    id: typeof s.id === 'string' ? s.id : crypto.randomUUID(),
    position: typeof s.position === 'number' ? s.position : index / Math.max(1, count - 1),
    label: typeof s.label === 'number' ? s.label : 0,
    hex,
    isBase: typeof s.isBase === 'boolean' ? s.isBase : false,
    locked: typeof s.locked === 'boolean' ? s.locked : false,
    curveValues: storedCurveValues
      ? { ...storedCurveValues, hue: legacyHueEncoding ? migrateLegacyHueCurveValue(storedCurveValues.hue) : storedCurveValues.hue }
      : curveValuesFromOklch(l, c, h, baseHue),
    oklch: (s.oklch && typeof s.oklch === 'object') ? s.oklch as { l: number; c: number; h: number } : { l, c, h },
    contrast: (s.contrast && typeof s.contrast === 'object')
      ? s.contrast as { onLight: number; onDark: number }
      : { onLight: 1, onDark: 1 },
  }
}

function migratePalette(raw: unknown, legacyHueEncoding: boolean): Palette {
  const p = raw as Record<string, unknown>
  const id = typeof p.id === 'string' ? p.id : crypto.randomUUID()
  const name = typeof p.name === 'string' ? p.name : 'Untitled'
  const baseHex = typeof p.baseHex === 'string' ? p.baseHex : '#808080'
  const activeMode: 'light' | 'dark' = p.activeMode === 'dark' ? 'dark' : 'light'
  const [, , baseHue] = hexToOklch(baseHex)

  // Old format: palette has `steps` directly
  if (Array.isArray(p.steps) && !p.modes) {
    const steps = p.steps as unknown[]
    return {
      id, name, baseHex, activeMode: 'light',
      modes: { light: steps.map((step, index) => migrateStep(step, index, steps.length, baseHue, legacyHueEncoding)), dark: null },
    }
  }

  // New format with `modes`
  const modes = p.modes as Record<string, unknown> | undefined
  const rawLightSteps = Array.isArray(modes?.light) ? modes.light as unknown[] : []
  const rawDarkSteps = Array.isArray(modes?.dark) ? modes.dark as unknown[] : null
  const lightSteps = rawLightSteps.map((step, index) => migrateStep(step, index, rawLightSteps.length, baseHue, legacyHueEncoding))
  const darkSteps = rawDarkSteps?.map((step, index) => migrateStep(step, index, rawDarkSteps.length, baseHue, legacyHueEncoding)) ?? null
  const curveBindings = migrateCurveBindings(p.curveBindings)
  const curveCorrections = migrateCurveCorrections(p.curveCorrections, legacyHueEncoding)
  const hasLegacyCurveLocks = Boolean(curveBindings) && !curveCorrections

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
    curveBindings,
    curveCorrections,
    curveStrategies: migrateCurveStrategies(p.curveStrategies),
    modes: {
      light: hasLegacyCurveLocks ? clearLegacyCurveLocks(lightSteps) : lightSteps,
      dark: hasLegacyCurveLocks && darkSteps ? clearLegacyCurveLocks(darkSteps) : darkSteps,
    },
  }
}

const CURVE_TYPES: CurveType[] = ['lightness', 'chroma', 'hue']
const CURVE_STRATEGIES: CurveConstraintStrategy[] = ['free', 'monotonic', 'smooth', 'anchored']

function migrateCurveStrategies(raw: unknown): Partial<Record<CurveType, CurveConstraintStrategy>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const strategies: Partial<Record<CurveType, CurveConstraintStrategy>> = {}
  for (const type of CURVE_TYPES) {
    if (CURVE_STRATEGIES.includes(source[type] as CurveConstraintStrategy)) strategies[type] = source[type] as CurveConstraintStrategy
  }
  return Object.keys(strategies).length ? strategies : undefined
}

function migrateCurveBindings(raw: unknown): Partial<Record<CurveType, string>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const bindings: Partial<Record<CurveType, string>> = {}
  for (const type of CURVE_TYPES) {
    if (typeof source[type] === 'string') bindings[type] = source[type]
  }
  return Object.keys(bindings).length > 0 ? bindings : undefined
}

function clearLegacyCurveLocks(steps: PaletteStep[]): PaletteStep[] {
  const generatedWereAllLocked = steps.filter((step) => !step.isBase).every((step) => step.locked)
  return generatedWereAllLocked ? steps.map((step) => step.isBase ? step : { ...step, locked: false }) : steps
}

function migrateCurveCorrections(raw: unknown, legacyHueEncoding: boolean): Partial<Record<CurveType, CurveCorrectionModes>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const result: Partial<Record<CurveType, CurveCorrectionModes>> = {}
  for (const type of CURVE_TYPES) {
    const modes = source[type]
    if (!modes || typeof modes !== 'object') continue
    const modeSource = modes as Record<string, unknown>
    const migratePoints = (candidate: unknown) => Array.isArray(candidate)
      ? candidate.flatMap((rawPoint) => {
          if (!rawPoint || typeof rawPoint !== 'object') return []
          const point = rawPoint as Record<string, unknown>
          if (typeof point.position !== 'number' || typeof point.value !== 'number') return []
          return [{
            id: typeof point.id === 'string' ? point.id : crypto.randomUUID(),
            position: Math.max(0, Math.min(1, point.position)),
            value: Math.max(-1, Math.min(1, type === 'hue' && legacyHueEncoding ? point.value / 9 : point.value)),
          }]
        }).sort((a, b) => a.position - b.position)
      : []
    result[type] = { light: migratePoints(modeSource.light), dark: migratePoints(modeSource.dark) }
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function migrateSavedCurves(raw: unknown, legacyHueEncoding: boolean): SavedCurve[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    const curve = candidate as Record<string, unknown>
    if (typeof curve.id !== 'string' || typeof curve.name !== 'string' || !CURVE_TYPES.includes(curve.type as CurveType) || !Array.isArray(curve.points)) return []
    const points = curve.points.flatMap((candidatePoint) => {
      if (!candidatePoint || typeof candidatePoint !== 'object') return []
      const point = candidatePoint as Record<string, unknown>
      return typeof point.position === 'number' && typeof point.value === 'number'
        ? [{
            id: typeof point.id === 'string' ? point.id : crypto.randomUUID(),
            position: Math.max(0, Math.min(1, point.position)),
            value: curve.type === 'hue' && legacyHueEncoding
              ? migrateLegacyHueCurveValue(point.value)
              : Math.max(0, Math.min(1, point.value)),
          }]
        : []
    })
    const orderedPoints = points
      .sort((a, b) => a.position - b.position)
      .filter((point, index, all) => index === all.length - 1 || Math.abs(point.position - all[index + 1]!.position) > 1e-6)
    if (orderedPoints.length < 2) return []
    return [{
      id: curve.id,
      name: curve.name,
      type: curve.type as CurveType,
      strategy: CURVE_STRATEGIES.includes(curve.strategy as CurveConstraintStrategy) ? curve.strategy as CurveConstraintStrategy : 'free',
      points: orderedPoints,
      createdAt: typeof curve.createdAt === 'number' ? curve.createdAt : Date.now(),
      updatedAt: typeof curve.updatedAt === 'number' ? curve.updatedAt : Date.now(),
    }]
  })
}

function migrateCurveSets(raw: unknown): CurveSetDefinition[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return []
    const set = candidate as Record<string, unknown>
    const curveIds = migrateCurveBindings(set.curveIds)
    if (typeof set.id !== 'string' || typeof set.name !== 'string' || !curveIds?.lightness || !curveIds.chroma || !curveIds.hue) return []
    return [{
      id: set.id,
      name: set.name,
      curveIds: curveIds as Record<CurveType, string>,
      createdAt: typeof set.createdAt === 'number' ? set.createdAt : Date.now(),
      updatedAt: typeof set.updatedAt === 'number' ? set.updatedAt : Date.now(),
    }]
  })
}

function migrateProject(project: Project): Project {
  const legacyProject = project as Project & { curvePresets?: unknown }
  const { curvePresets: legacyCurvePresets, ...currentProject } = legacyProject
  const legacyHueEncoding = project.curveDataVersion !== 2
  return {
    ...currentProject,
    curveDataVersion: 2,
    lightnessRange: project.lightnessRange ?? DEFAULT_LIGHTNESS_RANGE,
    palettes: (project.palettes as unknown[]).map((palette) => migratePalette(palette, legacyHueEncoding)),
    savedCurves: migrateSavedCurves(project.savedCurves, legacyHueEncoding),
    curveSets: migrateCurveSets(project.curveSets ?? legacyCurvePresets),
  }
}

export function serializeProject(project: Project): string {
  return JSON.stringify({ ...project, curveDataVersion: 2 })
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
