import { create } from 'zustand'
import { toast } from 'sonner'
import type { Project, Palette, PaletteStep, LightnessRange, LabelScale, PalettePreset } from '../types/project'
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

interface ProjectStore {
  libraryProjects: Project[]
  activeProject: Project | null
  isDirty: boolean
  tokenMissingRoles: PaletteRole[]
  lastSavedAt: number | null
  corruptedCount: number
  pendingDeletion: PendingDeletion | null
  saveBlocked: boolean

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

function clearPaletteAnchors(palette: Palette): Palette {
  return {
    ...palette,
    modes: {
      light: palette.modes.light.map((step) => ({ ...step, locked: false })),
      dark: palette.modes.dark?.map((step) => ({ ...step, locked: false })) ?? null,
    },
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

export const useProjectStore = create<ProjectStore>((set, get) => ({
  libraryProjects: [],
  activeProject: null,
  isDirty: false,
  tokenMissingRoles: [],
  lastSavedAt: null,
  corruptedCount: 0,
  pendingDeletion: null,
  saveBlocked: false,

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
      set({ activeProject: project, isDirty: false, lastSavedAt: project.updatedAt })
    } catch {
      deleteProject(id)
      set((s) => ({ libraryProjects: s.libraryProjects.filter((p) => p.id !== id) }))
    }
  },

  closeProject: () => {
    if (deletionTimer) { clearTimeout(deletionTimer); deletionTimer = null }
    set({ activeProject: null, isDirty: false, lastSavedAt: null, pendingDeletion: null, saveBlocked: false })
  },

  createNewProject: (initialPalettes?: Palette[]) => {
    const project = createProject(initialPalettes)
    saveProject(project)
    set((s) => ({
      libraryProjects: [project, ...s.libraryProjects],
      activeProject: project,
      isDirty: false,
      lastSavedAt: project.createdAt,
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
      return applyProjectLabels(regeneratePalette(p, clamped, activeProject.backgrounds, lRange, opts), activeProject)
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
      return applyProjectLabels(regeneratePalette(p, clamped, activeProject.backgrounds, lRange, opts), activeProject)
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
        return applyProjectLabels({ ...generateDarkMode(p, activeProject.backgrounds, lRange, opts), activeMode: mode }, activeProject)
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
        return applyProjectLabels({ ...generateDarkMode(p, activeProject.backgrounds, lRange, opts), activeMode: mode }, activeProject)
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
    const [l, c, h] = hexToOklch(hex)
    const palettes = activeProject.palettes.map((p) => {
      if (p.id !== paletteId) return p
      const edited = updateActiveSteps(p, (steps) =>
        steps.map((s) => s.label !== stepLabel ? s : {
          ...s,
          hex,
          locked: true,
          oklch: { l, c, h },
          contrast: {
            onLight: contrastRatio(hex, activeProject.backgrounds.light),
            onDark: contrastRatio(hex, activeProject.backgrounds.dark),
          },
        }),
      )
      const editsBase = getActiveSteps(p).some((s) => s.label === stepLabel && s.isBase)
      const anchored = editsBase ? { ...edited, baseHex: hex } : edited
      const { opts, lRange } = paletteGenOpts(anchored, activeProject)
      return applyProjectLabels(
        regeneratePalette(anchored, anchored.modes.light.length - 1, activeProject.backgrounds, lRange, opts),
        activeProject,
      )
    })
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  autoUpdatePaletteAction: (paletteId: string) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) => {
      if (p.id !== paletteId) return p
      const { opts, lRange } = paletteGenOpts(p, activeProject)
      return autoUpdatePalette(p, activeProject.backgrounds, lRange, opts)
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
      oklch: { l: nl, c: nc, h: nh },
      contrast: {
        onLight: contrastRatio(freshColor.hex, activeProject.backgrounds.light),
        onDark: contrastRatio(freshColor.hex, activeProject.backgrounds.dark),
      },
    }
    const withStep = updateActiveSteps(palette, (ss) =>
      [...ss, newStep].sort((a, b) => a.label - b.label),
    )
    const updatedPalette = applyProjectLabels(
      regeneratePalette(withStep, steps.length, activeProject.backgrounds, lRange, opts),
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
    const updatedPalette = applyProjectLabels(
      regeneratePalette(withoutStep, steps.length - 2, activeProject.backgrounds, lRange, opts),
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
    const updatedPalette = applyProjectLabels(
      regeneratePalette(withoutOldBase, stepCount, backgrounds, lRange, opts),
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
    const manualPalette: Palette = { ...palette, preset: 'manual', lightnessRange: lRange }
    const stepCount = manualPalette.modes.light.length - 1
    const { opts } = paletteGenOpts(manualPalette, activeProject)
    const updatedPalette = applyProjectLabels(
      regeneratePalette(manualPalette, stepCount, activeProject.backgrounds, lRange, opts),
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
    const final = applyProjectLabels(
      regeneratePalette(updatedPalette, stepCount, activeProject.backgrounds, lRange, opts),
      activeProject,
    )
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? final : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updatePaletteEnvelopeExponent: (paletteId: string, value: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const manualPalette: Palette = { ...palette, preset: 'manual', envelopeExponent: value }
    const stepCount = manualPalette.modes.light.length - 1
    const { opts, lRange } = paletteGenOpts(manualPalette, activeProject)
    const final = applyProjectLabels(
      regeneratePalette(manualPalette, stepCount, activeProject.backgrounds, lRange, opts),
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
    const manualPalette: Palette = {
      ...palette,
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
    const final = applyProjectLabels(
      regeneratePalette(manualPalette, stepCount, activeProject.backgrounds, lRange, opts),
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
    const manualPalette: Palette = { ...palette, preset: 'manual', lightnessDistribution: value }
    const stepCount = manualPalette.modes.light.length - 1
    const { opts, lRange } = paletteGenOpts(manualPalette, activeProject)
    const final = applyProjectLabels(
      regeneratePalette(manualPalette, stepCount, activeProject.backgrounds, lRange, opts),
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
      return applyProjectLabels(
        regeneratePalette(manual, manual.modes.light.length - 1, activeProject.backgrounds, lRange, opts),
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
      return applyProjectLabels(autoUpdatePalette(manual, activeProject.backgrounds, lRange, opts), activeProject)
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
      return applyProjectLabels(autoUpdatePalette(manual, activeProject.backgrounds, lRange, opts), activeProject)
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
