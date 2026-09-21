import { create } from 'zustand'
import { toast } from 'sonner'
import type { Project, Palette, PaletteStep, LightnessRange, LabelScale, PalettePreset, CurveShapePreset, CurveType, CurveSetDefinition, SavedCurve, CurveCorrectionPoint, CurveConstraintStrategy, CurveValues } from '../types/project'
import type { TokenRef } from '../types/tokens'
import { suggestTheme, getTargetHueForRole, getBrandHueFromPalettes, type PaletteRole } from '../lib/tokenSuggest'
import { DEFAULT_LABEL_SCALE, PALETTE_PRESETS, getActiveSteps } from '../types/project'
import { createProject } from '../lib/projectFactory'
import { saveProject, loadProject, deleteProject, listProjectIds, CorruptedProjectError } from '../lib/storage'
import { sortPalettes } from '../lib/paletteSort'
import { recalcContrast, regeneratePalette, autoUpdatePalette, generateDarkMode, generateModeSteps, normalizeTailwindLabels, relabelPalette, paletteGenOpts, validateBasePosition, generatePalette, type GenOpts } from '../lib/generatePalette'
import { adjustStepForWcagTarget } from '../lib/wcagTarget'
import { hexToOklch } from '../lib/color'
import { inferPaletteName } from '../lib/paletteName'
import { contrastRatio } from '../lib/wcag'
import { generateDiverseColor } from '../lib/randomColor'
import { applyCurveShapePreset as reshapeCurveAsset, applySavedCurve as applyCurveAsset, captureCurve, curveSemanticPosition, sampleCurve, sampleCurveCorrection, updateCurveAtPosition, updateCurvePointById } from '../lib/savedCurves'
import { constrainCurveStepValue, curvePlotValue } from '../lib/curveChart'
import { curveValuesFromOklch, editCurveIntent, renderCurveValues } from '../lib/curveEngine'

function projectGenOpts(project: Project): GenOpts {
  return {
    envelopeExponent: project.envelopeExponent,
    lightnessDistribution: project.lightnessDistribution,
  }
}

function applyProjectLabels(palette: Palette, project: Project): Palette {
  return relabelPalette(
    palette,
    paletteGenOpts(palette, project).lRange,
    project.labelScale ?? DEFAULT_LABEL_SCALE,
  )
}

function countLockedLost(palettes: Palette[], newStepCount: number): number {
  const availableAnchorSlots = Math.max(0, newStepCount)
  return palettes.reduce((lost, palette) => {
    const lightLocked = palette.modes.light.filter((step) => step.locked && !step.isBase).length
    const darkLocked = palette.modes.dark?.filter((step) => step.locked && !step.isBase).length ?? 0
    return lost
      + Math.max(0, lightLocked - availableAnchorSlots)
      + Math.max(0, darkLocked - availableAnchorSlots)
  }, 0)
}

const MIN_STEPS = 2
const MAX_STEPS = 20

let deletionTimer: ReturnType<typeof setTimeout> | null = null

interface PendingDeletion {
  palette: Palette
  index: number
}

interface CurveEditHistoryEntry {
  before: SavedCurve
  after: SavedCurve
}

interface ProjectStore {
  libraryProjects: Project[]
  activeProject: Project | null
  isDirty: boolean
  tokenMissingRoles: PaletteRole[]
  lastSavedAt: number | null
  corruptedCount: number
  pendingDeletion: PendingDeletion | null
  saveBlocked: boolean
  curveHistoryPast: CurveEditHistoryEntry[]
  curveHistoryFuture: CurveEditHistoryEntry[]
  curvePreview: SavedCurve | null
  curvePreviewKind: 'preset' | 'drag' | null

  loadLibrary: () => void
  openProject: (id: string) => void
  closeProject: () => void
  createNewProject: (initialPalettes?: Palette[]) => Project
  renameLibraryProject: (id: string, name: string) => void
  removeProject: (id: string) => void
  updateProjectName: (name: string) => void
  addPalette: (palette: Palette) => void
  reorderPalettes: (orderedIds: string[]) => void
  renamePalette: (paletteId: string, name: string) => void
  deletePalette: (paletteId: string) => void
  undoDeletePalette: () => void
  commitDeletion: () => void
  updateProjectStepCount: (count: number) => void
  updatePaletteStepCount: (paletteId: string, count: number) => void
  updateBackgrounds: (backgrounds: { light: string; dark: string }) => void
  switchPaletteMode: (paletteId: string, mode: 'light' | 'dark') => void
  switchProjectPaletteMode: (mode: 'light' | 'dark') => void
  lockStep: (paletteId: string, stepLabel: number) => void
  unlockStep: (paletteId: string, stepLabel: number) => void
  updateStepHex: (paletteId: string, stepLabel: number, hex: string) => void
  updateCurveStep: (paletteId: string, stepLabel: number, type: CurveType, value: number) => void
  updateCurveStrategy: (paletteId: string, type: CurveType, strategy: CurveConstraintStrategy) => void
  updateSavedCurveAtPosition: (curveId: string, position: number, value: number) => void
  updateSavedCurvePoint: (curveId: string, pointId: string, value: number) => void
  updateSavedCurveStrategy: (curveId: string, strategy: CurveConstraintStrategy) => void
  previewSavedCurveValue: (curveId: string, position: number, value: number) => void
  previewSavedCurvePoint: (curveId: string, pointId: string, value: number) => void
  previewCurveShapePreset: (curveId: string, preset: CurveShapePreset) => void
  commitCurvePreview: () => void
  cancelCurvePreview: () => void
  undoCurveEdit: () => void
  redoCurveEdit: () => void
  detachSavedCurve: (paletteId: string, type: CurveType) => void
  saveCurve: (paletteId: string, type: CurveType, name: string) => string | null
  saveCurveSet: (paletteId: string, name: string) => string | null
  applySavedCurve: (paletteIds: string[], curveId: string) => void
  applyCurveSet: (paletteIds: string[], setId: string) => void
  autoUpdatePaletteAction: (paletteId: string) => void
  adjustStepForWcagTargetAction: (paletteId: string, stepLabel: number, targetRatio: number, backgroundHex: string) => void
  insertStep: (paletteId: string, leftLabel: number | null, rightLabel: number | null) => void
  deleteStep: (paletteId: string, stepLabel: number) => void
  recalibratePaletteToStep: (paletteId: string, stepLabel: number) => void
  updatePaletteLightnessRange: (paletteId: string, lRange: LightnessRange) => void
  applyPalettePreset: (paletteId: string, preset: PalettePreset) => void
  updatePaletteEnvelopeExponent: (paletteId: string, value: number) => void
  updatePaletteCurve: (paletteId: string, values: Partial<Pick<Palette, 'lightChromaFalloff' | 'darkChromaFalloff' | 'lightHueShift' | 'darkHueShift'>>) => void
  updatePaletteLightnessDistribution: (paletteId: string, value: 'linear' | 'perceptual') => void
  suggestTokenTheme: () => void
  generateAndAddRolePalette: (role: PaletteRole) => void
  assignToken: (tokenId: string, mode: 'light' | 'dark', ref: TokenRef | null) => void
  assignRolePalette: (role: PaletteRole, paletteId: string) => void
  clearTheme: () => void
  setLabelScale: (scale: LabelScale) => void
  updateLightnessRange: (lRange: LightnessRange) => void
  updateEnvelopeExponent: (value: number) => void
  updateLightnessDistribution: (value: 'linear' | 'perceptual') => void
  normalizeAllLabels: () => void
  markDirty: () => void
  markSaved: (timestamp: number) => void
  saveNow: () => void
}

// Derive the most-used paletteId per role from an existing theme.
// Used to preserve manual role assignments across Sync.
function buildRoleOverrides(
  theme: { groups: { tokens: { id: string; light?: { paletteId: string } | null; dark?: { paletteId: string } | null }[] }[] },
  palettes: Palette[],
): Partial<Record<string, string>> {
  const roles = ['brand', 'neutral', 'danger', 'success', 'warning', 'informative', 'discovery'] as const
  const overrides: Partial<Record<string, string>> = {}
  for (const role of roles) {
    const counts = new Map<string, number>()
    for (const group of theme.groups) {
      for (const token of group.tokens) {
        if (!token.id.split('/').includes(role)) continue
        if (token.light?.paletteId) counts.set(token.light.paletteId, (counts.get(token.light.paletteId) ?? 0) + 1)
        if (token.dark?.paletteId)  counts.set(token.dark.paletteId,  (counts.get(token.dark.paletteId)  ?? 0) + 1)
      }
    }
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    if (top && palettes.some((p) => p.id === top)) overrides[role] = top
  }
  return overrides
}

function patchLibrary(libraryProjects: Project[], updated: Project): Project[] {
  return libraryProjects.map((p) => (p.id === updated.id ? updated : p))
}

function updateActiveSteps(
  palette: Palette,
  updater: (steps: PaletteStep[]) => PaletteStep[],
): Palette {
  const mode = palette.activeMode
  const current = getActiveSteps(palette)
  const updated = updater(current)
  return {
    ...palette,
    modes: {
      ...palette.modes,
      [mode]: updated,
    },
  }
}

function correctionsForBindings(palette: Palette, curveBindings: Palette['curveBindings']): Palette['curveCorrections'] {
  if (!curveBindings) return undefined
  const corrections = Object.fromEntries(
    Object.keys(curveBindings).flatMap((type) => {
      const correction = palette.curveCorrections?.[type as CurveType]
      return correction ? [[type, correction]] : []
    }),
  ) as NonNullable<Palette['curveCorrections']>
  return Object.keys(corrections).length > 0 ? corrections : undefined
}

function updatePaletteStepColor(
  palette: Palette,
  stepLabel: number,
  hex: string,
  project: Project,
  curveBindings: Palette['curveBindings'],
): Palette {
  const [l, c, h] = hexToOklch(hex)
  const activeSteps = getActiveSteps(palette)
  const baseHue = activeSteps.find((step) => step.isBase)?.oklch.h ?? h
  const edited = updateActiveSteps(palette, (steps) =>
    steps.map((step) => step.label !== stepLabel ? step : {
      ...step,
      hex,
      locked: true,
      curveValues: curveValuesFromOklch(l, c, h, baseHue),
      oklch: { l, c, h },
      contrast: {
        onLight: contrastRatio(hex, project.backgrounds.light),
        onDark: contrastRatio(hex, project.backgrounds.dark),
      },
    }),
  )
  const editsBase = getActiveSteps(palette).some((step) => step.label === stepLabel && step.isBase)
  const anchored = { ...edited, ...(editsBase ? { baseHex: hex } : {}), curveBindings, curveCorrections: correctionsForBindings(palette, curveBindings) }
  const { opts, lRange } = paletteGenOpts(anchored, project)
  return applyProjectLabels(
    regeneratePalette(anchored, anchored.modes.light.length - 1, project.backgrounds, lRange, opts),
    project,
  )
}

function updatePaletteCurvePoint(
  palette: Palette,
  stepLabel: number,
  hex: string,
  project: Project,
  curveBindings: Palette['curveBindings'],
  requestedCurveValues?: CurveValues,
): Palette {
  const [parsedL, parsedC, parsedH] = hexToOklch(hex)
  const baseHue = getActiveSteps(palette).find((step) => step.isBase)?.oklch.h ?? parsedH
  const curveValues = requestedCurveValues ?? curveValuesFromOklch(parsedL, parsedC, parsedH, baseHue)
  const { oklch: { l, c, h } } = renderCurveValues(curveValues, baseHue)
  const editsBase = getActiveSteps(palette).some((step) => step.label === stepLabel && step.isBase)
  const edited = updateActiveSteps(palette, (steps) =>
    steps.map((step) => step.label !== stepLabel ? step : {
      ...step,
      hex,
      locked: true,
      curveValues,
      oklch: { l, c, h },
      contrast: {
        onLight: contrastRatio(hex, project.backgrounds.light),
        onDark: contrastRatio(hex, project.backgrounds.dark),
      },
    }),
  )
  return {
    ...edited,
    preset: 'manual',
    ...(editsBase ? { baseHex: hex } : {}),
    curveBindings,
    curveCorrections: correctionsForBindings(palette, curveBindings),
  }
}

function clearPaletteAnchors(palette: Palette): Palette {
  return {
    ...palette,
    modes: {
      light: palette.modes.light.map((step) => ({ ...step, locked: false })),
      dark: palette.modes.dark?.map((step) => ({ ...step, locked: false })) ?? null,
    },
  }
}

function detachCurveTypes(palette: Palette, types: CurveType[]): Palette {
  const curveBindings = { ...palette.curveBindings }
  const curveCorrections = { ...palette.curveCorrections }
  for (const type of types) delete curveBindings[type]
  for (const type of types) delete curveCorrections[type]
  return {
    ...palette,
    curveBindings: Object.keys(curveBindings).length > 0 ? curveBindings : undefined,
    curveCorrections: Object.keys(curveCorrections).length > 0 ? curveCorrections : undefined,
  }
}

function bindCurveWithoutCorrection(palette: Palette, type: CurveType, curveId: string): Palette {
  const curveCorrections = { ...palette.curveCorrections }
  delete curveCorrections[type]
  return {
    ...palette,
    curveBindings: { ...palette.curveBindings, [type]: curveId },
    curveCorrections: Object.keys(curveCorrections).length > 0 ? curveCorrections : undefined,
  }
}

function materializeManualPalette(palette: Palette, project: Project): Palette {
  const { opts, lRange } = paletteGenOpts(palette, project)
  return {
    ...palette,
    preset: 'manual',
    lightnessRange: { ...lRange },
    envelopeExponent: opts.envelopeExponent,
    lightChromaFalloff: opts.lightChromaFalloff,
    darkChromaFalloff: opts.darkChromaFalloff,
    lightHueShift: opts.lightHueShift,
    darkHueShift: opts.darkHueShift,
    lightnessDistribution: opts.lightnessDistribution,
  }
}

function applyCurveVersion(project: Project, curve: SavedCurve): Project {
  const savedCurves = (project.savedCurves ?? []).map((candidate) => candidate.id === curve.id ? curve : candidate)
  const withCurve = { ...project, savedCurves }
  const palettes = project.palettes.map((candidate) => candidate.curveBindings?.[curve.type] === curve.id
    ? materializeBoundCurves(candidate, withCurve)
    : candidate)
  return { ...project, savedCurves, palettes, updatedAt: Date.now() }
}

function materializeBoundCurves(palette: Palette, project: Project): Palette {
  return (['lightness', 'chroma', 'hue'] as CurveType[]).reduce((current, type) => {
    const curveId = current.curveBindings?.[type]
    const curve = project.savedCurves?.find((candidate) => candidate.id === curveId)
    return curve ? applyCurveAsset(current, curve, project.backgrounds) : current
  }, palette)
}

function updateLocalCurveCorrection(
  palette: Palette,
  curve: SavedCurve,
  stepId: string,
  desiredValue: number,
  backgrounds: Project['backgrounds'],
): Palette {
  const mode = palette.activeMode
  const steps = getActiveSteps(palette)
  const target = steps.find((step) => step.id === stepId)
  if (!target || target.isBase) return palette
  const position = curveSemanticPosition(target, mode)
  const existing = palette.curveCorrections?.[curve.type]?.[mode]
  const points: CurveCorrectionPoint[] = steps.map((step) => {
    const pointPosition = curveSemanticPosition(step, mode)
    const previous = existing?.find((point) => Math.abs(point.position - pointPosition) <= 0.001)
    return {
      id: previous?.id ?? crypto.randomUUID(),
      position: pointPosition,
      value: sampleCurveCorrection(existing, pointPosition),
    }
  })
  const targetPoint = points.find((point) => Math.abs(point.position - position) <= 0.001)
  if (!targetPoint) return palette
  targetPoint.value = Math.max(-1, Math.min(1, desiredValue - sampleCurve(curve, position)))
  points.sort((a, b) => a.position - b.position)
  const curveCorrections = {
    ...palette.curveCorrections,
    [curve.type]: {
      light: palette.curveCorrections?.[curve.type]?.light ?? [],
      dark: palette.curveCorrections?.[curve.type]?.dark ?? [],
      [mode]: points,
    },
  }
  return applyCurveAsset({ ...palette, curveCorrections }, curve, backgrounds)
}

function appendCurveHistory(history: CurveEditHistoryEntry[], entry: CurveEditHistoryEntry): CurveEditHistoryEntry[] {
  return [...history, entry].slice(-50)
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  libraryProjects: [],
  activeProject: null,
  isDirty: false,
  tokenMissingRoles: [],
  lastSavedAt: null,
  corruptedCount: 0,
  pendingDeletion: null,
  saveBlocked: false,
  curveHistoryPast: [],
  curveHistoryFuture: [],
  curvePreview: null,
  curvePreviewKind: null,

  loadLibrary: () => {
    const ids = listProjectIds()
    const projects: Project[] = []
    let corruptedCount = 0
    for (const id of ids) {
      try {
        projects.push(loadProject(id))
      } catch (e) {
        if (e instanceof CorruptedProjectError) {
          deleteProject(id)
          corruptedCount++
        }
      }
    }
    projects.sort((a, b) => b.createdAt - a.createdAt)
    set({ libraryProjects: projects, corruptedCount })
  },

  openProject: (id: string) => {
    try {
      const project = loadProject(id)
      set({ activeProject: project, isDirty: false, lastSavedAt: project.updatedAt, curveHistoryPast: [], curveHistoryFuture: [], curvePreview: null, curvePreviewKind: null })
    } catch {
      deleteProject(id)
      set((s) => ({ libraryProjects: s.libraryProjects.filter((p) => p.id !== id) }))
    }
  },

  closeProject: () => {
    if (deletionTimer) { clearTimeout(deletionTimer); deletionTimer = null }
    set({ activeProject: null, isDirty: false, lastSavedAt: null, pendingDeletion: null, saveBlocked: false, curveHistoryPast: [], curveHistoryFuture: [], curvePreview: null, curvePreviewKind: null })
  },

  createNewProject: (initialPalettes?: Palette[]) => {
    const project = createProject(initialPalettes)
    saveProject(project)
    set((s) => ({
      libraryProjects: [project, ...s.libraryProjects],
      activeProject: project,
      isDirty: false,
      lastSavedAt: project.createdAt,
      curveHistoryPast: [],
      curveHistoryFuture: [],
      curvePreview: null,
      curvePreviewKind: null,
    }))
    return project
  },

  renameLibraryProject: (id: string, name: string) => {
    const project = loadProject(id)
    const updated = { ...project, name, updatedAt: Date.now() }
    saveProject(updated)
    set((s) => ({
      libraryProjects: patchLibrary(s.libraryProjects, updated),
      activeProject: s.activeProject?.id === id ? updated : s.activeProject,
    }))
  },

  removeProject: (id: string) => {
    deleteProject(id)
    set((s) => ({
      libraryProjects: s.libraryProjects.filter((p) => p.id !== id),
      activeProject: s.activeProject?.id === id ? null : s.activeProject,
    }))
  },

  updateProjectName: (name: string) => {
    const { activeProject } = get()
    if (!activeProject) return
    const updated = { ...activeProject, name, updatedAt: Date.now() }
    saveProject(updated)
    set((s) => ({ activeProject: updated, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  addPalette: (palette: Palette) => {
    const { activeProject } = get()
    if (!activeProject) return
    const scale = activeProject.labelScale ?? DEFAULT_LABEL_SCALE
    const labeled = relabelPalette(palette, activeProject.lightnessRange, scale)
    const palettes = sortPalettes([...activeProject.palettes, labeled])
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  reorderPalettes: (orderedIds: string[]) => {
    const { activeProject } = get()
    if (!activeProject) return
    const map = new Map(activeProject.palettes.map((p) => [p.id, p]))
    const palettes = orderedIds.flatMap((id) => (map.has(id) ? [map.get(id)!] : []))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  renamePalette: (paletteId: string, name: string) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) => p.id === paletteId ? { ...p, name } : p)
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  deletePalette: (paletteId: string) => {
    const { activeProject } = get()
    if (!activeProject) return
    if (deletionTimer) { clearTimeout(deletionTimer); deletionTimer = null }
    const index = activeProject.palettes.findIndex((p) => p.id === paletteId)
    if (index === -1) return
    const palette = activeProject.palettes[index]!
    const palettes = activeProject.palettes.filter((p) => p.id !== paletteId)
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({
      activeProject: updated,
      pendingDeletion: { palette, index },
      saveBlocked: true,
      libraryProjects: patchLibrary(s.libraryProjects, updated),
    }))
    deletionTimer = setTimeout(() => { get().commitDeletion() }, 10_000)
  },

  undoDeletePalette: () => {
    const { activeProject, pendingDeletion } = get()
    if (!activeProject || !pendingDeletion) return
    if (deletionTimer) { clearTimeout(deletionTimer); deletionTimer = null }
    const palettes = sortPalettes([...activeProject.palettes, pendingDeletion.palette])
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({
      activeProject: updated,
      pendingDeletion: null,
      saveBlocked: false,
      libraryProjects: patchLibrary(s.libraryProjects, updated),
    }))
  },

  commitDeletion: () => {
    deletionTimer = null
    set({ pendingDeletion: null, saveBlocked: false, isDirty: true })
  },

  updateProjectStepCount: (count: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const clamped = Math.max(MIN_STEPS, Math.min(MAX_STEPS, count))
    if (clamped < activeProject.stepCount) {
      const lost = countLockedLost(activeProject.palettes, clamped)
      if (lost > 0) toast.warning(`${lost} locked step${lost > 1 ? 's' : ''} will be removed.`)
    }
    const palettes = activeProject.palettes.map((p) => {
      const { opts, lRange } = paletteGenOpts(p, activeProject)
      return materializeBoundCurves(
        applyProjectLabels(regeneratePalette(p, clamped, activeProject.backgrounds, lRange, opts), activeProject),
        activeProject,
      )
    })
    const updated = { ...activeProject, stepCount: clamped, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updatePaletteStepCount: (paletteId: string, count: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const clamped = Math.max(MIN_STEPS, Math.min(MAX_STEPS, count))
    const palettes = activeProject.palettes.map((p) => {
      if (p.id !== paletteId) return p
      const { opts, lRange } = paletteGenOpts(p, activeProject)
      return materializeBoundCurves(
        applyProjectLabels(regeneratePalette(p, clamped, activeProject.backgrounds, lRange, opts), activeProject),
        activeProject,
      )
    })
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updateBackgrounds: (backgrounds: { light: string; dark: string }) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) => recalcContrast(p, backgrounds))
    const updated = { ...activeProject, backgrounds, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  switchPaletteMode: (paletteId: string, mode: 'light' | 'dark') => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) => {
      if (p.id !== paletteId) return p
      if (mode === 'dark' && p.modes.dark === null) {
        const { opts, lRange } = paletteGenOpts(p, activeProject)
        return materializeBoundCurves(
          applyProjectLabels({ ...generateDarkMode(p, activeProject.backgrounds, lRange, opts), activeMode: mode }, activeProject),
          activeProject,
        )
      }
      return { ...p, activeMode: mode }
    })
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  switchProjectPaletteMode: (mode: 'light' | 'dark') => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) => {
      if (mode === 'dark' && p.modes.dark === null) {
        const { opts, lRange } = paletteGenOpts(p, activeProject)
        return materializeBoundCurves(
          applyProjectLabels({ ...generateDarkMode(p, activeProject.backgrounds, lRange, opts), activeMode: mode }, activeProject),
          activeProject,
        )
      }
      return { ...p, activeMode: mode }
    })
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  lockStep: (paletteId: string, stepLabel: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) =>
      p.id !== paletteId ? p : updateActiveSteps(p, (steps) =>
        steps.map((s) => s.label === stepLabel ? { ...s, locked: true } : s),
      ),
    )
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  unlockStep: (paletteId: string, stepLabel: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) =>
      p.id !== paletteId ? p : updateActiveSteps(p, (steps) =>
        steps.map((s) => s.label === stepLabel ? { ...s, locked: false } : s),
      ),
    )
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updateStepHex: (paletteId: string, stepLabel: number, hex: string) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) => {
      if (p.id !== paletteId) return p
      const steps = getActiveSteps(p)
      const step = steps.find((candidate) => candidate.label === stepLabel)
      if (!step) return p
      if (step.isBase) {
        return materializeBoundCurves(
          updatePaletteStepColor(p, stepLabel, hex, activeProject, p.curveBindings),
          activeProject,
        )
      }
      const boundTypes = (['lightness', 'chroma', 'hue'] as CurveType[]).filter((type) => p.curveBindings?.[type])
      if (boundTypes.length === 0) return updatePaletteStepColor(p, stepLabel, hex, activeProject, undefined)
      const [l, c, h] = hexToOklch(hex)
      const baseHue = steps.find((candidate) => candidate.isBase)?.oklch.h ?? h
      const targetStep = { ...step, hex, locked: true, curveValues: curveValuesFromOklch(l, c, h, baseHue), oklch: { l, c, h } }
      const desired = Object.fromEntries(boundTypes.map((type) => [type, curvePlotValue(targetStep, baseHue, type)])) as Partial<Record<CurveType, number>>
      const edited = updateActiveSteps(p, (current) => current.map((candidate) => candidate.id === step.id
        ? {
            ...targetStep,
            contrast: {
              onLight: contrastRatio(hex, activeProject.backgrounds.light),
              onDark: contrastRatio(hex, activeProject.backgrounds.dark),
            },
          }
        : candidate))
      const corrected = boundTypes.reduce((current, type) => {
        const curve = activeProject.savedCurves?.find((candidate) => candidate.id === current.curveBindings?.[type])
        return curve ? updateLocalCurveCorrection(current, curve, step.id, desired[type]!, activeProject.backgrounds) : current
      }, edited)
      return materializeBoundCurves(corrected, activeProject)
    })
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updateCurveStep: (paletteId, stepLabel, type, value) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((candidate) => candidate.id === paletteId)
    if (!palette) return
    const steps = getActiveSteps(palette)
    const stepIndex = steps.findIndex((step) => step.label === stepLabel)
    if (stepIndex === -1) return
    const strategy = palette.curveStrategies?.[type] ?? 'free'
    const constrainedValue = constrainCurveStepValue(steps, stepIndex, type, value, strategy)
    if (constrainedValue === steps[stepIndex]!.curveValues[type] && strategy !== 'smooth') return
    const baseHue = steps.find((step) => step.isBase)?.oklch.h ?? 0
    const editedIntents = editCurveIntent(steps, stepIndex, type, constrainedValue, strategy)
    const rendered = renderCurveValues(editedIntents[stepIndex]!, baseHue)
    const hex = rendered.hex

    // The base is the palette seed rather than a local curve correction. Let it
    // move, then rebuild both modes around the new seed and reapply bound curves.
    if (steps[stepIndex]!.isBase) {
      const palettes = activeProject.palettes.map((candidate) => candidate.id === paletteId
        ? materializeBoundCurves(
            updatePaletteStepColor(candidate, stepLabel, hex, activeProject, candidate.curveBindings),
            activeProject,
          )
        : candidate)
      const updated = { ...activeProject, palettes, updatedAt: Date.now() }
      set((state) => ({
        activeProject: updated,
        isDirty: true,
        libraryProjects: patchLibrary(state.libraryProjects, updated),
        curvePreview: null,
        curvePreviewKind: null,
      }))
      return
    }

    const bindingId = palette.curveBindings?.[type]
    const boundCurve = activeProject.savedCurves?.find((curve) => curve.id === bindingId)

    if (boundCurve) {
      const palettes = activeProject.palettes.map((candidate) => candidate.id === paletteId
        ? materializeBoundCurves(
            updateLocalCurveCorrection(candidate, boundCurve, steps[stepIndex]!.id, constrainedValue, activeProject.backgrounds),
            activeProject,
          )
        : candidate)
      const updated = { ...activeProject, palettes, updatedAt: Date.now() }
      set((state) => ({
        activeProject: updated,
        isDirty: true,
        libraryProjects: patchLibrary(state.libraryProjects, updated),
        curvePreview: null,
        curvePreviewKind: null,
      }))
      return
    }

    const remainingBindings = { ...palette.curveBindings }
    delete remainingBindings[type]
    const curveBindings = Object.keys(remainingBindings).length > 0 ? remainingBindings : undefined
    const palettes = activeProject.palettes.map((candidate) =>
      candidate.id === paletteId
        ? (() => {
            let edited = candidate
            editedIntents.forEach((intent, index) => {
              if (intent[type] === steps[index]!.curveValues[type]) return
              const result = renderCurveValues(intent, baseHue)
              edited = updatePaletteCurvePoint(edited, steps[index]!.label, result.hex, activeProject, curveBindings, intent)
            })
            return edited
          })()
        : candidate,
    )
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((state) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(state.libraryProjects, updated) }))
  },

  updateCurveStrategy: (paletteId, type, strategy) => {
    const { activeProject } = get()
    if (!activeProject) return
    const boundCurveId = activeProject.palettes.find((palette) => palette.id === paletteId)?.curveBindings?.[type]
    if (boundCurveId) {
      get().updateSavedCurveStrategy(boundCurveId, strategy)
      return
    }
    const palettes = activeProject.palettes.map((palette) => palette.id === paletteId
      ? { ...palette, curveStrategies: { ...palette.curveStrategies, [type]: strategy } }
      : palette)
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((state) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(state.libraryProjects, updated) }))
  },

  updateSavedCurveAtPosition: (curveId, position, value) => {
    const { activeProject } = get()
    if (!activeProject) return
    const curve = activeProject.savedCurves?.find((candidate) => candidate.id === curveId)
    if (!curve) return
    const updatedCurve = updateCurveAtPosition(curve, position, value)
    if (sampleCurve(curve, position) === sampleCurve(updatedCurve, position)) return
    const updated = applyCurveVersion(activeProject, updatedCurve)
    set((state) => ({
      activeProject: updated,
      isDirty: true,
      libraryProjects: patchLibrary(state.libraryProjects, updated),
      curveHistoryPast: appendCurveHistory(state.curveHistoryPast, { before: curve, after: updatedCurve }),
      curveHistoryFuture: [],
      curvePreview: null,
      curvePreviewKind: null,
    }))
  },

  updateSavedCurveStrategy: (curveId, strategy) => {
    const { activeProject } = get()
    if (!activeProject) return
    const curve = activeProject.savedCurves?.find((candidate) => candidate.id === curveId)
    if (!curve || curve.strategy === strategy) return
    const updatedCurve = { ...curve, strategy, updatedAt: Date.now() }
    const updated = applyCurveVersion(activeProject, updatedCurve)
    set((state) => ({
      activeProject: updated,
      isDirty: true,
      libraryProjects: patchLibrary(state.libraryProjects, updated),
      curveHistoryPast: appendCurveHistory(state.curveHistoryPast, { before: curve, after: updatedCurve }),
      curveHistoryFuture: [],
    }))
  },

  updateSavedCurvePoint: (curveId, pointId, value) => {
    const { activeProject } = get()
    if (!activeProject) return
    const curve = activeProject.savedCurves?.find((candidate) => candidate.id === curveId)
    if (!curve) return
    const updatedCurve = updateCurvePointById(curve, pointId, value)
    if (updatedCurve === curve) return
    const updated = applyCurveVersion(activeProject, updatedCurve)
    set((state) => ({
      activeProject: updated,
      isDirty: true,
      libraryProjects: patchLibrary(state.libraryProjects, updated),
      curveHistoryPast: appendCurveHistory(state.curveHistoryPast, { before: curve, after: updatedCurve }),
      curveHistoryFuture: [],
      curvePreview: null,
      curvePreviewKind: null,
    }))
  },

  previewSavedCurveValue: (curveId, position, value) => {
    const { activeProject, curvePreview } = get()
    if (!activeProject) return
    const curve = curvePreview?.id === curveId
      ? curvePreview
      : activeProject.savedCurves?.find((candidate) => candidate.id === curveId)
    if (!curve) return
    set({ curvePreview: updateCurveAtPosition(curve, position, value), curvePreviewKind: 'drag' })
  },

  previewSavedCurvePoint: (curveId, pointId, value) => {
    const { activeProject, curvePreview } = get()
    if (!activeProject) return
    const curve = curvePreview?.id === curveId
      ? curvePreview
      : activeProject.savedCurves?.find((candidate) => candidate.id === curveId)
    if (!curve) return
    const updatedCurve = updateCurvePointById(curve, pointId, value)
    if (updatedCurve === curve) return
    set({ curvePreview: updatedCurve, curvePreviewKind: 'drag' })
  },

  previewCurveShapePreset: (curveId, preset) => {
    const { activeProject } = get()
    if (!activeProject) return
    const curve = activeProject.savedCurves?.find((candidate) => candidate.id === curveId)
    if (!curve) return
    set({ curvePreview: reshapeCurveAsset(curve, preset), curvePreviewKind: 'preset' })
  },

  commitCurvePreview: () => {
    const { activeProject, curvePreview } = get()
    if (!activeProject || !curvePreview) return
    const curve = activeProject.savedCurves?.find((candidate) => candidate.id === curvePreview.id)
    if (!curve) return
    const updated = applyCurveVersion(activeProject, curvePreview)
    set((state) => ({
      activeProject: updated,
      isDirty: true,
      libraryProjects: patchLibrary(state.libraryProjects, updated),
      curveHistoryPast: appendCurveHistory(state.curveHistoryPast, { before: curve, after: curvePreview }),
      curveHistoryFuture: [],
      curvePreview: null,
      curvePreviewKind: null,
    }))
  },

  cancelCurvePreview: () => set({ curvePreview: null, curvePreviewKind: null }),

  undoCurveEdit: () => {
    const { activeProject, curveHistoryPast } = get()
    const entry = curveHistoryPast[curveHistoryPast.length - 1]
    if (!activeProject || !entry) return
    const updated = applyCurveVersion(activeProject, entry.before)
    set((state) => ({
      activeProject: updated,
      isDirty: true,
      libraryProjects: patchLibrary(state.libraryProjects, updated),
      curveHistoryPast: state.curveHistoryPast.slice(0, -1),
      curveHistoryFuture: [...state.curveHistoryFuture, entry],
      curvePreview: null,
      curvePreviewKind: null,
    }))
  },

  redoCurveEdit: () => {
    const { activeProject, curveHistoryFuture } = get()
    const entry = curveHistoryFuture[curveHistoryFuture.length - 1]
    if (!activeProject || !entry) return
    const updated = applyCurveVersion(activeProject, entry.after)
    set((state) => ({
      activeProject: updated,
      isDirty: true,
      libraryProjects: patchLibrary(state.libraryProjects, updated),
      curveHistoryPast: appendCurveHistory(state.curveHistoryPast, entry),
      curveHistoryFuture: state.curveHistoryFuture.slice(0, -1),
      curvePreview: null,
      curvePreviewKind: null,
    }))
  },

  detachSavedCurve: (paletteId, type) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((candidate) => candidate.id === paletteId
      ? detachCurveTypes(candidate, [type])
      : candidate)
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((state) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(state.libraryProjects, updated) }))
  },

  saveCurve: (paletteId, type, name) => {
    const { activeProject } = get()
    if (!activeProject) return null
    const palette = activeProject.palettes.find((candidate) => candidate.id === paletteId)
    const trimmedName = name.trim()
    if (!palette || !trimmedName) return null
    const curve = captureCurve(palette, type, trimmedName)
    const palettes = activeProject.palettes.map((candidate) => candidate.id === paletteId
      ? bindCurveWithoutCorrection(candidate, type, curve.id)
      : candidate)
    const updated = {
      ...activeProject,
      savedCurves: [...(activeProject.savedCurves ?? []), curve],
      palettes,
      updatedAt: Date.now(),
    }
    set((state) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(state.libraryProjects, updated) }))
    return curve.id
  },

  saveCurveSet: (paletteId, name) => {
    const { activeProject } = get()
    if (!activeProject) return null
    const palette = activeProject.palettes.find((candidate) => candidate.id === paletteId)
    const trimmedName = name.trim()
    if (!palette || !trimmedName) return null
    const now = Date.now()
    const curves = (['lightness', 'chroma', 'hue'] as CurveType[]).map((type) =>
      captureCurve(palette, type, `${trimmedName} · ${type[0]!.toUpperCase()}${type.slice(1)}`, now),
    )
    const curveIds = Object.fromEntries(curves.map((curve) => [curve.type, curve.id])) as Record<CurveType, string>
    const curveSet: CurveSetDefinition = {
      id: crypto.randomUUID(),
      name: trimmedName,
      curveIds,
      createdAt: now,
      updatedAt: now,
    }
    const palettes = activeProject.palettes.map((candidate) => candidate.id === paletteId
      ? { ...candidate, curveBindings: curveIds, curveCorrections: undefined }
      : candidate)
    const updated = {
      ...activeProject,
      savedCurves: [...(activeProject.savedCurves ?? []), ...curves],
      curveSets: [...(activeProject.curveSets ?? []), curveSet],
      palettes,
      updatedAt: now,
    }
    set((state) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(state.libraryProjects, updated) }))
    return curveSet.id
  },

  applySavedCurve: (paletteIds, curveId) => {
    const { activeProject } = get()
    if (!activeProject) return
    const curve = activeProject.savedCurves?.find((candidate) => candidate.id === curveId)
    const targetIds = new Set(paletteIds)
    if (!curve || targetIds.size === 0) return
    const palettes = activeProject.palettes.map((palette) => targetIds.has(palette.id)
      ? applyCurveAsset(palette, curve, activeProject.backgrounds)
      : palette)
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((state) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(state.libraryProjects, updated) }))
  },

  applyCurveSet: (paletteIds, setId) => {
    const { activeProject } = get()
    if (!activeProject) return
    const curveSet = activeProject.curveSets?.find((candidate) => candidate.id === setId)
    const targetIds = new Set(paletteIds)
    if (!curveSet || targetIds.size === 0) return
    const curves = (['lightness', 'chroma', 'hue'] as CurveType[]).map((type) =>
      activeProject.savedCurves?.find((curve) => curve.id === curveSet.curveIds[type]),
    )
    if (curves.some((curve) => !curve)) return
    const palettes = activeProject.palettes.map((palette) => {
      if (!targetIds.has(palette.id)) return palette
      return curves.reduce((current, curve) => applyCurveAsset(current, curve!, activeProject.backgrounds), palette)
    })
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((state) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(state.libraryProjects, updated) }))
  },

  autoUpdatePaletteAction: (paletteId: string) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) => {
      if (p.id !== paletteId) return p
      const { opts, lRange } = paletteGenOpts(p, activeProject)
      return materializeBoundCurves(autoUpdatePalette(p, activeProject.backgrounds, lRange, opts), activeProject)
    })
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  adjustStepForWcagTargetAction: (paletteId: string, stepLabel: number, targetRatio: number, backgroundHex: string) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const step = getActiveSteps(palette).find((s) => s.label === stepLabel)
    if (!step) return
    const newHex = adjustStepForWcagTarget(step.hex, targetRatio, backgroundHex)
    get().updateStepHex(paletteId, stepLabel, newHex)
  },

  insertStep: (paletteId: string, leftLabel: number | null, rightLabel: number | null) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const steps = getActiveSteps(palette)
    const leftStep = leftLabel !== null ? (steps.find((s) => s.label === leftLabel) ?? null) : null
    const rightStep = rightLabel !== null ? (steps.find((s) => s.label === rightLabel) ?? null) : null
    if (!leftStep && !rightStep) return

    // Compute the new label position
    let newLabel: number
    if (leftStep && rightStep) {
      newLabel = Math.round((leftStep.label + rightStep.label) / 2)
    } else if (leftStep) {
      const prevIdx = steps.indexOf(leftStep) - 1
      const spacing = prevIdx >= 0 ? leftStep.label - steps[prevIdx]!.label : leftStep.label
      newLabel = leftStep.label + Math.round(spacing / 2)
    } else {
      const rightIdx = steps.indexOf(rightStep!)
      const nextIdx = rightIdx + 1
      const spacing = nextIdx < steps.length ? steps[nextIdx]!.label - rightStep!.label : rightStep!.label
      newLabel = rightStep!.label - Math.round(spacing / 2)
      if (newLabel < 0) newLabel = Math.round(rightStep!.label / 2)
    }
    if (steps.some((s) => s.label === newLabel)) return

    // Generate n+1 fresh steps from this palette's effective curve and find
    // the step closest to the requested insertion position.
    const mode = palette.activeMode
    const { opts, lRange } = paletteGenOpts(palette, activeProject)
    const freshSteps = generateModeSteps(
      palette.baseHex,
      steps.length,
      activeProject.backgrounds,
      mode,
      lRange,
      opts,
    )
    const targetPosition = leftStep && rightStep
      ? ((leftStep.position ?? steps.indexOf(leftStep) / Math.max(1, steps.length - 1))
        + (rightStep.position ?? steps.indexOf(rightStep) / Math.max(1, steps.length - 1))) / 2
      : leftStep
        ? Math.min(1, (leftStep.position ?? steps.indexOf(leftStep) / Math.max(1, steps.length - 1)) + 1 / steps.length)
        : Math.max(0, (rightStep!.position ?? steps.indexOf(rightStep!) / Math.max(1, steps.length - 1)) - 1 / steps.length)
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < freshSteps.length; i++) {
      const dist = Math.abs(freshSteps[i]!.position - targetPosition)
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
    }
    const freshColor = freshSteps[bestIdx]!

    const [nl, nc, nh] = hexToOklch(freshColor.hex)
    const newStep: PaletteStep = {
      id: crypto.randomUUID(),
      position: freshColor.position,
      label: newLabel,
      hex: freshColor.hex,
      isBase: false,
      locked: false,
      curveValues: freshColor.curveValues,
      oklch: { l: nl, c: nc, h: nh },
      contrast: {
        onLight: contrastRatio(freshColor.hex, activeProject.backgrounds.light),
        onDark: contrastRatio(freshColor.hex, activeProject.backgrounds.dark),
      },
    }
    const withStep = updateActiveSteps(palette, (ss) =>
      [...ss, newStep].sort((a, b) => a.label - b.label),
    )
    const updatedPalette = materializeBoundCurves(
      applyProjectLabels(regeneratePalette(withStep, steps.length, activeProject.backgrounds, lRange, opts), activeProject),
      activeProject,
    )
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? updatedPalette : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  deleteStep: (paletteId: string, stepLabel: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const steps = getActiveSteps(palette)
    if (steps.length <= 2) return // enforce minimum 2 steps
    const withoutStep = updateActiveSteps(palette, (ss) => ss.filter((s) => s.label !== stepLabel))
    const { opts, lRange } = paletteGenOpts(withoutStep, activeProject)
    const updatedPalette = materializeBoundCurves(
      applyProjectLabels(regeneratePalette(withoutStep, steps.length - 2, activeProject.backgrounds, lRange, opts), activeProject),
      activeProject,
    )
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? updatedPalette : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  recalibratePaletteToStep: (paletteId: string, stepLabel: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const step = getActiveSteps(palette).find((s) => s.label === stepLabel)
    if (!step) return

    const newBaseHex = step.hex
    const [cL, cC, cH] = hexToOklch(newBaseHex)

    const { backgrounds } = activeProject
    const stepCount = palette.modes.light.length - 1
    const { opts, lRange } = paletteGenOpts(palette, activeProject)

    const err = validateBasePosition(newBaseHex, stepCount, lRange, opts, palette.activeMode)
    if (err === 'too-light') { toast.error('This step is too light to use as a base — pick a mid-range step.'); return }
    if (err === 'too-dark')  { toast.error('This step is too dark to use as a base — pick a mid-range step.'); return }

    const otherPalettes = activeProject.palettes.filter((p) => p.id !== paletteId)
    const newName = inferPaletteName(cH, cC, cL, otherPalettes)

    const withoutOldBase: Palette = {
      ...palette,
      name: newName,
      baseHex: newBaseHex,
      modes: {
        light: palette.modes.light.map((s) => ({ ...s, isBase: false, locked: false })),
        dark: palette.modes.dark?.map((s) => ({ ...s, isBase: false, locked: false })) ?? null,
      },
    }
    const updatedPalette = materializeBoundCurves(
      applyProjectLabels(regeneratePalette(withoutOldBase, stepCount, backgrounds, lRange, opts), activeProject),
      activeProject,
    )
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? updatedPalette : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updatePaletteLightnessRange: (paletteId: string, lRange: LightnessRange) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const manualPalette: Palette = { ...detachCurveTypes(palette, ['lightness']), preset: 'manual', lightnessRange: lRange }
    const stepCount = manualPalette.modes.light.length - 1
    const { opts } = paletteGenOpts(manualPalette, activeProject)
    const updatedPalette = materializeBoundCurves(
      applyProjectLabels(regeneratePalette(manualPalette, stepCount, activeProject.backgrounds, lRange, opts), activeProject),
      activeProject,
    )
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? updatedPalette : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  applyPalettePreset: (paletteId: string, preset: PalettePreset) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const current = paletteGenOpts(palette, activeProject)
    const recipe = preset === 'manual' ? null : PALETTE_PRESETS[preset]
    const configuredPalette: Palette = {
      ...palette,
      preset,
      curveBindings: undefined,
      curveCorrections: undefined,
      lightnessRange: recipe?.lightnessRange ?? current.lRange,
      envelopeExponent: recipe?.envelopeExponent ?? current.opts.envelopeExponent,
      lightChromaFalloff: recipe?.envelopeExponent ?? current.opts.lightChromaFalloff,
      darkChromaFalloff: recipe?.envelopeExponent ?? current.opts.darkChromaFalloff,
      lightHueShift: current.opts.lightHueShift ?? 0,
      darkHueShift: current.opts.darkHueShift ?? 0,
      lightnessDistribution: recipe?.lightnessDistribution ?? current.opts.lightnessDistribution,
    }
    const updatedPalette = preset === 'manual' ? configuredPalette : clearPaletteAnchors(configuredPalette)
    const stepCount = updatedPalette.modes.light.length - 1
    const { opts, lRange } = paletteGenOpts(updatedPalette, activeProject)
    const final = applyProjectLabels(regeneratePalette(updatedPalette, stepCount, activeProject.backgrounds, lRange, opts), activeProject)
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? final : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updatePaletteEnvelopeExponent: (paletteId: string, value: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const manualPalette: Palette = { ...detachCurveTypes(palette, ['chroma']), preset: 'manual', envelopeExponent: value }
    const stepCount = manualPalette.modes.light.length - 1
    const { opts, lRange } = paletteGenOpts(manualPalette, activeProject)
    const final = materializeBoundCurves(
      applyProjectLabels(regeneratePalette(manualPalette, stepCount, activeProject.backgrounds, lRange, opts), activeProject),
      activeProject,
    )
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? final : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updatePaletteCurve: (paletteId, values) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const current = paletteGenOpts(palette, activeProject)
    const detachedTypes: CurveType[] = [
      ...(values.lightChromaFalloff !== undefined || values.darkChromaFalloff !== undefined ? ['chroma' as const] : []),
      ...(values.lightHueShift !== undefined || values.darkHueShift !== undefined ? ['hue' as const] : []),
    ]
    const manualPalette: Palette = {
      ...detachCurveTypes(palette, detachedTypes),
      preset: 'manual',
      lightnessRange: current.lRange,
      envelopeExponent: current.opts.envelopeExponent,
      lightnessDistribution: current.opts.lightnessDistribution,
      lightChromaFalloff: current.opts.lightChromaFalloff,
      darkChromaFalloff: current.opts.darkChromaFalloff,
      lightHueShift: current.opts.lightHueShift,
      darkHueShift: current.opts.darkHueShift,
      ...values,
    }
    const stepCount = manualPalette.modes.light.length - 1
    const { opts, lRange } = paletteGenOpts(manualPalette, activeProject)
    const final = materializeBoundCurves(
      applyProjectLabels(regeneratePalette(manualPalette, stepCount, activeProject.backgrounds, lRange, opts), activeProject),
      activeProject,
    )
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? final : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updatePaletteLightnessDistribution: (paletteId: string, value: 'linear' | 'perceptual') => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const manualPalette: Palette = { ...detachCurveTypes(palette, ['lightness']), preset: 'manual', lightnessDistribution: value }
    const stepCount = manualPalette.modes.light.length - 1
    const { opts, lRange } = paletteGenOpts(manualPalette, activeProject)
    const final = materializeBoundCurves(
      applyProjectLabels(regeneratePalette(manualPalette, stepCount, activeProject.backgrounds, lRange, opts), activeProject),
      activeProject,
    )
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? final : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  suggestTokenTheme: () => {
    const { activeProject } = get()
    if (!activeProject) return
    // Preserve any manual role assignments the user has made
    const overrides = activeProject.theme
      ? buildRoleOverrides(activeProject.theme, activeProject.palettes)
      : {}
    const { theme, missingRoles } = suggestTheme(activeProject.palettes, overrides)
    const updated = { ...activeProject, theme, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, tokenMissingRoles: missingRoles, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  generateAndAddRolePalette: (role: PaletteRole) => {
    const { activeProject } = get()
    if (!activeProject) return

    const brandHue = getBrandHueFromPalettes(activeProject.palettes)
    const targetHue = getTargetHueForRole(role, brandHue)
    const opts = projectGenOpts(activeProject)

    const hex = generateDiverseColor({
      existingHexes: activeProject.palettes.map((palette) => palette.baseHex),
      stepCount: activeProject.stepCount,
      lightnessRange: activeProject.lightnessRange,
      genOpts: opts,
      mode: 'light',
      targetHue,
      hueRadius: 12,
    })

    if (!hex) {
      toast.error(`Could not generate a valid ${role} palette. Try adjusting project lightness settings.`)
      return
    }

    const name = role.charAt(0).toUpperCase() + role.slice(1)
    const rawPalette = generatePalette(
      hex,
      activeProject.stepCount,
      activeProject.backgrounds,
      activeProject.palettes,
      activeProject.lightnessRange,
      projectGenOpts(activeProject),
    )
    const namedPalette = { ...rawPalette, name }
    const scale = activeProject.labelScale ?? DEFAULT_LABEL_SCALE
    const labeled = relabelPalette(namedPalette, activeProject.lightnessRange, scale)
    const palettes = sortPalettes([...activeProject.palettes, labeled])
    const { theme, missingRoles } = suggestTheme(palettes)
    const updated = { ...activeProject, palettes, theme, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, tokenMissingRoles: missingRoles, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
    toast.success(`Generated "${name}" palette and synced tokens.`)
  },

  assignToken: (tokenId: string, mode: 'light' | 'dark', ref: TokenRef | null) => {
    const { activeProject } = get()
    if (!activeProject) return
    const theme = activeProject.theme
    if (!theme) return
    const groups = theme.groups.map((g) => ({
      ...g,
      tokens: g.tokens.map((t) =>
        t.id === tokenId ? { ...t, [mode]: ref } : t,
      ),
    }))
    const updated = { ...activeProject, theme: { ...theme, groups }, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  assignRolePalette: (role: PaletteRole, paletteId: string) => {
    const { activeProject } = get()
    if (!activeProject?.theme) return
    // Merge current role overrides with the new assignment, then re-suggest so
    // any null slots get properly filled with the right step labels.
    const overrides = {
      ...buildRoleOverrides(activeProject.theme, activeProject.palettes),
      [role]: paletteId,
    }
    const { theme: suggested, missingRoles } = suggestTheme(activeProject.palettes, overrides)
    // Apply suggested tokens for this role; leave all other tokens untouched.
    const suggestedMap = new Map(
      suggested.groups.flatMap((g) => g.tokens).map((t) => [t.id, t]),
    )
    const groups = activeProject.theme.groups.map((g) => ({
      ...g,
      tokens: g.tokens.map((t) => {
        if (!t.id.split('/').includes(role)) return t
        return suggestedMap.get(t.id) ?? t
      }),
    }))
    const updated = { ...activeProject, theme: { ...activeProject.theme, groups }, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, tokenMissingRoles: missingRoles, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  clearTheme: () => {
    const { activeProject } = get()
    if (!activeProject) return
    const updated = { ...activeProject, theme: undefined, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  setLabelScale: (scale: LabelScale) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) =>
      relabelPalette(p, activeProject.lightnessRange, scale)
    )
    const updated = { ...activeProject, labelScale: scale, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updateLightnessRange: (lRange: LightnessRange) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((palette) => {
      const manual = { ...materializeManualPalette(palette, activeProject), lightnessRange: lRange }
      const { opts } = paletteGenOpts(manual, activeProject)
      return materializeBoundCurves(
        applyProjectLabels(regeneratePalette(manual, manual.modes.light.length - 1, activeProject.backgrounds, lRange, opts), activeProject),
        activeProject,
      )
    })
    const updated = { ...activeProject, lightnessRange: lRange, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updateEnvelopeExponent: (value: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((palette) => {
      const manual = {
        ...materializeManualPalette(palette, activeProject),
        envelopeExponent: value,
        lightChromaFalloff: value,
        darkChromaFalloff: value,
      }
      const { opts, lRange } = paletteGenOpts(manual, activeProject)
      return materializeBoundCurves(applyProjectLabels(autoUpdatePalette(manual, activeProject.backgrounds, lRange, opts), activeProject), activeProject)
    })
    const updated = { ...activeProject, envelopeExponent: value, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updateLightnessDistribution: (value: 'linear' | 'perceptual') => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((palette) => {
      const manual = { ...materializeManualPalette(palette, activeProject), lightnessDistribution: value }
      const { opts, lRange } = paletteGenOpts(manual, activeProject)
      return materializeBoundCurves(applyProjectLabels(autoUpdatePalette(manual, activeProject.backgrounds, lRange, opts), activeProject), activeProject)
    })
    const updated = { ...activeProject, lightnessDistribution: value, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  normalizeAllLabels: () => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) =>
      normalizeTailwindLabels(p, activeProject.backgrounds, activeProject.lightnessRange)
    )
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  markDirty: () => set({ isDirty: true }),

  markSaved: (timestamp: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const updated = { ...activeProject, updatedAt: timestamp }
    set((s) => ({
      activeProject: updated,
      isDirty: false,
      lastSavedAt: timestamp,
      libraryProjects: patchLibrary(s.libraryProjects, updated),
    }))
  },

  saveNow: () => {
    const { activeProject } = get()
    if (!activeProject) return
    const timestamp = Date.now()
    const updated = { ...activeProject, updatedAt: timestamp }
    saveProject(updated)
    set((s) => ({
      activeProject: updated,
      isDirty: false,
      lastSavedAt: timestamp,
      libraryProjects: patchLibrary(s.libraryProjects, updated),
    }))
  },
}))
