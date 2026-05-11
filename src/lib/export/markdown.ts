import type { Project, Palette } from '../../types/project'
import { getActiveSteps } from '../../types/project'

function paletteToMd(palette: Palette): string {
  const steps = getActiveSteps(palette)
  const rows = steps.map((s) =>
    `| ${s.label} | \`${s.hex.toUpperCase()}\` | \`oklch(${s.oklch.l.toFixed(3)} ${s.oklch.c.toFixed(3)} ${s.oklch.h.toFixed(1)})\` |`,
  )
  return [
    `## ${palette.name}`,
    '',
    '| Label | Hex | OKLCH |',
    '|-------|-----|-------|',
    ...rows,
  ].join('\n')
}

export function paletteToMarkdown(palette: Palette): string {
  return paletteToMd(palette)
}

export function projectToMarkdown(project: Project): string {
  return [`# ${project.name}`, '', ...project.palettes.map(paletteToMd)].join('\n\n')
}
