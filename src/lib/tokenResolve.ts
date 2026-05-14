import type { Palette } from '../types/project'
import type { TokenRef, Theme, ThemeToken } from '../types/tokens'

function getModeSteps(palette: Palette, mode: 'light' | 'dark') {
  return (mode === 'dark' ? palette.modes.dark : null) ?? palette.modes.light
}

export function resolveRef(ref: TokenRef, palettes: Palette[], mode: 'light' | 'dark' = 'light'): string | null {
  const palette = palettes.find((p) => p.id === ref.paletteId)
  if (!palette) return null
  const steps = getModeSteps(palette, mode)
  const step = steps.find((s) => s.label === ref.stepLabel)
  return step?.hex ?? null
}

export function resolveToken(token: ThemeToken, palettes: Palette[], mode: 'light' | 'dark'): string | null {
  const ref = mode === 'dark' ? token.dark : token.light
  if (!ref) return null
  return resolveRef(ref, palettes, mode)
}

export function resolveTheme(
  theme: Theme,
  palettes: Palette[],
  mode: 'light' | 'dark',
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const group of theme.groups) {
    for (const token of group.tokens) {
      const hex = resolveToken(token, palettes, mode)
      if (hex) result[token.id] = hex
    }
  }
  return result
}

export function isBrokenRef(ref: TokenRef, palettes: Palette[], mode: 'light' | 'dark' = 'light'): boolean {
  return resolveRef(ref, palettes, mode) === null
}
