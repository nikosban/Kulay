import type { Project, Palette } from '../../types/project'
import { getActiveSteps } from '../../types/project'
import { triggerDownload } from './download'

const TAILWIND_DEFAULTS = new Set([
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber',
  'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue',
  'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
])

export function getTailwindConflicts(palettes: Palette[]): string[] {
  return palettes
    .filter((p) => TAILWIND_DEFAULTS.has(p.name.toLowerCase()))
    .map((p) => p.name)
}

function paletteToColorObj(palette: Palette): string {
  const lines = getActiveSteps(palette).map((s) => `          ${s.label}: "${s.hex}",`)
  return `        ${palette.name.toLowerCase()}: {\n${lines.join('\n')}\n        },`
}

function buildTailwindJs(palettes: Palette[]): string {
  const colorBlocks = palettes.map(paletteToColorObj).join('\n')
  return `module.exports = {
  theme: {
    extend: {
      colors: {
${colorBlocks}
      },
    },
  },
}
`
}

export function exportProjectTailwind(project: Project): void {
  triggerDownload(
    new Blob([buildTailwindJs(project.palettes)], { type: 'text/javascript' }),
    `${project.name.toLowerCase().replace(/\s+/g, '-')}-tailwind.js`,
  )
}

export function exportPaletteTailwind(palette: Palette): void {
  triggerDownload(
    new Blob([buildTailwindJs([palette])], { type: 'text/javascript' }),
    `${palette.name.toLowerCase().replace(/\s+/g, '-')}-tailwind.js`,
  )
}
