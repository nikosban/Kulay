import type { Palette } from '../../types/project'
import { getTailwindConflicts } from './tailwindConfig'

export interface ExportWarnings {
  duplicateNames: string[]
  tailwindConflicts: string[]
}

export function getExportWarnings(palettes: Palette[]): ExportWarnings {
  const nameCounts: Record<string, number> = {}
  for (const p of palettes) {
    nameCounts[p.name] = (nameCounts[p.name] ?? 0) + 1
  }
  const duplicateNames = Object.entries(nameCounts)
    .filter(([, count]) => count > 1)
    .map(([name]) => name)

  return {
    duplicateNames,
    tailwindConflicts: getTailwindConflicts(palettes),
  }
}
