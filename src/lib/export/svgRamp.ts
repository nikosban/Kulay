import type { Palette } from '../../types/project'
import { getActiveSteps } from '../../types/project'
import { relativeLuminance } from '../wcag'
import { triggerDownload } from './download'
import JSZip from 'jszip'

const TILE_W = 80
const TILE_H = 120
const RECT_H = 80

function textColor(hex: string): string {
  return relativeLuminance(hex) > 0.18 ? '#111111' : '#ffffff'
}

export function buildSvgRamp(palette: Palette): string {
  const steps = getActiveSteps(palette)
  const w = TILE_W * steps.length
  const tiles = steps
    .map((step, i) => {
      const x = i * TILE_W
      const fg = textColor(step.hex)
      return `
  <rect x="${x}" y="0" width="${TILE_W}" height="${RECT_H}" fill="${step.hex}"/>
  <text x="${x + TILE_W / 2}" y="${RECT_H - 24}" font-family="monospace" font-size="9" fill="${fg}" text-anchor="middle">${step.hex.toUpperCase()}</text>
  <text x="${x + TILE_W / 2}" y="${RECT_H - 12}" font-family="monospace" font-size="9" fill="${fg}" text-anchor="middle">${step.label}</text>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${TILE_H}" viewBox="0 0 ${w} ${TILE_H}">${tiles}
</svg>`
}

export function exportPaletteSvg(palette: Palette): void {
  const svg = buildSvgRamp(palette)
  triggerDownload(
    new Blob([svg], { type: 'image/svg+xml' }),
    `${palette.name.toLowerCase().replace(/\s+/g, '-')}.svg`,
  )
}

export async function exportProjectSvgZip(projectName: string, palettes: Palette[]): Promise<void> {
  const zip = new JSZip()
  for (const palette of palettes) {
    const svg = buildSvgRamp(palette)
    zip.file(`${palette.name.toLowerCase().replace(/\s+/g, '-')}.svg`, svg)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${projectName.toLowerCase().replace(/\s+/g, '-')}-svgs.zip`)
}
