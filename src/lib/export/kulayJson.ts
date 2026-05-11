import type { Project, Palette } from '../../types/project'
import { triggerDownload } from './download'

function toKebab(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ── String builders (for clipboard copy) ─────────────────────────────────────

export function projectKulayJson(project: Project): string {
  return JSON.stringify({ ...project, savedAt: Date.now() }, null, 2)
}

export function paletteKulayJson(project: Project, palette: Palette): string {
  return JSON.stringify({ ...project, palettes: [palette], savedAt: Date.now() }, null, 2)
}

// ── File downloads ────────────────────────────────────────────────────────────

export function exportProjectKulay(project: Project): void {
  triggerDownload(
    new Blob([projectKulayJson(project)], { type: 'application/json' }),
    `kulay-${toKebab(project.name)}.json`,
  )
}

export function exportPaletteKulay(project: Project, palette: Palette): void {
  triggerDownload(
    new Blob([paletteKulayJson(project, palette)], { type: 'application/json' }),
    `kulay-${toKebab(palette.name)}.json`,
  )
}
