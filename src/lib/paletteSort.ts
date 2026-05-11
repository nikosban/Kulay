import type { Palette } from '../types/project'
import { hexToOklch } from './color'

const HUE_GROUP_ORDER = [
  'Neutral', 'Red', 'Orange', 'Amber', 'Yellow',
  'Green', 'Teal', 'Cyan', 'Blue', 'Indigo', 'Violet', 'Pink',
]

function getHueGroup(baseHex: string): string {
  const [, C, H] = hexToOklch(baseHex)
  if (C < 0.04) return 'Neutral'
  if (H <= 15 || H >= 345) return 'Red'
  if (H <= 40) return 'Orange'
  if (H <= 65) return 'Amber'
  if (H <= 85) return 'Yellow'
  if (H <= 150) return 'Green'
  if (H <= 185) return 'Teal'
  if (H <= 230) return 'Cyan'
  if (H <= 265) return 'Blue'
  if (H <= 290) return 'Indigo'
  if (H <= 320) return 'Violet'
  if (H <= 344) return 'Pink'
  return 'Red'
}

export function sortPalettes(palettes: Palette[]): Palette[] {
  return [...palettes].sort((a, b) => {
    const groupA = HUE_GROUP_ORDER.indexOf(getHueGroup(a.baseHex))
    const groupB = HUE_GROUP_ORDER.indexOf(getHueGroup(b.baseHex))
    if (groupA !== groupB) return groupA - groupB
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  })
}
