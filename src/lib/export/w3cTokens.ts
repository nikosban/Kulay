import type { Project, Palette } from '../../types/project'
import { getActiveSteps } from '../../types/project'
import { triggerDownload } from './download'

function paletteToTokens(palette: Palette): Record<string, { $value: string; $type: string }> {
  const tokens: Record<string, { $value: string; $type: string }> = {}
  for (const step of getActiveSteps(palette)) {
    tokens[String(step.label)] = { $value: step.hex, $type: 'color' }
  }
  return tokens
}

export function exportProjectW3C(project: Project): void {
  const output: Record<string, unknown> = {}
  for (const palette of project.palettes) {
    output[palette.name.toLowerCase()] = paletteToTokens(palette)
  }
  triggerDownload(
    new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }),
    `${project.name.toLowerCase().replace(/\s+/g, '-')}-tokens.json`,
  )
}

export function exportPaletteW3C(palette: Palette): void {
  const output = { [palette.name.toLowerCase()]: paletteToTokens(palette) }
  triggerDownload(
    new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }),
    `${palette.name.toLowerCase().replace(/\s+/g, '-')}-tokens.json`,
  )
}
