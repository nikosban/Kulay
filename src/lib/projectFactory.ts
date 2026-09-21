import type { Project, Palette } from '../types/project'
import { DEFAULT_LIGHTNESS_RANGE } from '../types/project'

export function createProject(initialPalettes?: Palette[]): Project {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    curveDataVersion: 2,
    name: 'Untitled',
    stepCount: 10,
    backgrounds: {
      light: '#ffffff',
      dark: '#000000',
    },
    lightnessRange: DEFAULT_LIGHTNESS_RANGE,
    palettes: initialPalettes ?? [],
    savedCurves: [],
    curveSets: [],
    createdAt: now,
    updatedAt: now,
  }
}
