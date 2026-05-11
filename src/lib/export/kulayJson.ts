import type { Project, Palette } from '../../types/project'

function toKebab(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function exportProjectKulay(project: Project): void {
  const payload = { ...project, savedAt: Date.now() }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  download(blob, `kulay-${toKebab(project.name)}.json`)
}

export function exportPaletteKulay(project: Project, palette: Palette): void {
  const payload = { ...project, palettes: [palette], savedAt: Date.now() }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  download(blob, `kulay-${toKebab(palette.name)}.json`)
}

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
