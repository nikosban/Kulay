import { create } from 'zustand'
import type { Project, Palette, PaletteStep, LightnessRange, LabelScale } from '../types/project'
import { DEFAULT_LABEL_SCALE, getActiveSteps } from '../types/project'
import { createProject } from '../lib/projectFactory'
import { saveProject, loadProject, deleteProject, listProjectIds, CorruptedProjectError } from '../lib/storage'
import { sortPalettes } from '../lib/paletteSort'
import { recalcContrast, regeneratePalette, autoUpdatePalette, generateDarkMode, generateModeSteps, normalizeTailwindLabels, relabelPalette } from '../lib/generatePalette'
import { adjustStepForWcagTarget } from '../lib/wcagTarget'
import { hexToOklch, clampToGamut, oklchToHex } from '../lib/color'
import { inferPaletteName } from '../lib/paletteName'
import { contrastRatio } from '../lib/wcag'

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
  setLabelScale: (scale: LabelScale) => void
  updateLightnessRange: (lRange: LightnessRange) => void
  normalizeAllLabels: () => void
  markDirty: () => void
  markSaved: (timestamp: number) => void
  saveNow: () => void
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

export const useProjectStore = create<ProjectStore>((set, get) => ({
  libraryProjects: [],
  activeProject: null,
  isDirty: false,
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
    const palettes = activeProject.palettes.map((p) =>
      regeneratePalette(p, clamped, activeProject.backgrounds, activeProject.lightnessRange),
    )
    const updated = { ...activeProject, stepCount: clamped, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updatePaletteStepCount: (paletteId: string, count: number) => {
    const { activeProject } = get()
    if (!activeProject) return
    const clamped = Math.max(MIN_STEPS, Math.min(MAX_STEPS, count))
    const palettes = activeProject.palettes.map((p) =>
      p.id === paletteId
        ? regeneratePalette(p, clamped, activeProject.backgrounds, activeProject.lightnessRange)
        : p,
    )
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
        return { ...generateDarkMode(p, activeProject.backgrounds, activeProject.lightnessRange), activeMode: mode }
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
        return { ...generateDarkMode(p, activeProject.backgrounds, activeProject.lightnessRange), activeMode: mode }
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
    const palettes = activeProject.palettes.map((p) =>
      p.id !== paletteId ? p : updateActiveSteps(p, (steps) =>
        steps.map((s) => s.label !== stepLabel ? s : {
          ...s,
          hex,
          oklch: { l, c, h },
          contrast: {
            onLight: contrastRatio(hex, activeProject.backgrounds.light),
            onDark: contrastRatio(hex, activeProject.backgrounds.dark),
          },
        }),
      ),
    )
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  autoUpdatePaletteAction: (paletteId: string) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palettes = activeProject.palettes.map((p) =>
      p.id !== paletteId ? p : autoUpdatePalette(p, activeProject.backgrounds, activeProject.lightnessRange),
    )
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

    // Generate n+1 fresh steps and find the one closest to newLabel's position
    const mode = palette.activeMode
    const freshSteps = generateModeSteps(
      palette.baseHex,
      steps.length, // n+1 total steps
      activeProject.backgrounds,
      mode,
      activeProject.lightnessRange,
    )
    // freshSteps has n+1 entries; find the one whose label is closest to newLabel
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < freshSteps.length; i++) {
      const dist = Math.abs(freshSteps[i]!.label - newLabel)
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
    }
    const freshColor = freshSteps[bestIdx]!

    const [nl, nc, nh] = hexToOklch(freshColor.hex)
    const newStep: PaletteStep = {
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
    const scale = activeProject.labelScale ?? DEFAULT_LABEL_SCALE
    const updatedPalette = relabelPalette(withStep, activeProject.lightnessRange, scale)
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
    const scale = activeProject.labelScale ?? DEFAULT_LABEL_SCALE
    const updatedPalette = relabelPalette(withoutStep, activeProject.lightnessRange, scale)
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

    // Use the step's exact hex as the new base so all three of L, C, H are honoured.
    // Previously only H+C were taken (L was borrowed from the old baseHex), which meant
    // edits to a step's lightness or full colour were silently discarded on recalibrate.
    const newBaseHex = step.hex
    const [cL, cC, cH] = hexToOklch(newBaseHex)

    const { backgrounds, lightnessRange, stepCount } = activeProject
    const lightSteps = generateModeSteps(newBaseHex, stepCount, backgrounds, 'light', lightnessRange)
    const darkSteps = palette.modes.dark
      ? generateModeSteps(newBaseHex, stepCount, backgrounds, 'dark', lightnessRange)
      : null

    // Derive a new name from the new hue — pass all other palettes so collisions resolve to "Blue 2" etc.
    const otherPalettes = activeProject.palettes.filter((p) => p.id !== paletteId)
    const newName = inferPaletteName(cH, cC, cL, otherPalettes)

    const scale = activeProject.labelScale ?? DEFAULT_LABEL_SCALE
    const withSteps: Palette = { ...palette, name: newName, baseHex: newBaseHex, modes: { light: lightSteps, dark: darkSteps } }
    const updatedPalette = relabelPalette(withSteps, lightnessRange, scale)
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? updatedPalette : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
    set((s) => ({ activeProject: updated, isDirty: true, libraryProjects: patchLibrary(s.libraryProjects, updated) }))
  },

  updatePaletteLightnessRange: (paletteId: string, lRange: LightnessRange) => {
    const { activeProject } = get()
    if (!activeProject) return
    const palette = activeProject.palettes.find((p) => p.id === paletteId)
    if (!palette) return
    const stepCount = palette.modes.light.length - 1
    const lightSteps = generateModeSteps(palette.baseHex, stepCount, activeProject.backgrounds, 'light', lRange)
    const darkSteps = palette.modes.dark
      ? generateModeSteps(palette.baseHex, stepCount, activeProject.backgrounds, 'dark', lRange)
      : null
    const updatedPalette: Palette = { ...palette, lightnessRange: lRange, modes: { light: lightSteps, dark: darkSteps } }
    const palettes = activeProject.palettes.map((p) => (p.id === paletteId ? updatedPalette : p))
    const updated = { ...activeProject, palettes, updatedAt: Date.now() }
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
    const palettes = activeProject.palettes.map((p) =>
      regeneratePalette(p, p.modes.light.length - 1, activeProject.backgrounds, lRange),
    )
    const updated = { ...activeProject, lightnessRange: lRange, palettes, updatedAt: Date.now() }
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
