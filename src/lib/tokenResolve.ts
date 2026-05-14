import type { Palette } from '../types/project'
import type { TokenRef, Theme, ThemeToken } from '../types/tokens'
import { getActiveSteps } from '../types/project'

export function resolveRef(ref: TokenRef, palettes: Palette[]): string | null {
  const palette = palettes.find((p) => p.id === ref.paletteId)
  if (!palette) return null
  const step = getActiveSteps(palette).find((s) => s.label === ref.stepLabel)
  return step?.hex ?? null
}

export function resolveToken(token: ThemeToken, palettes: Palette[], mode: 'light' | 'dark'): string | null {
  const ref = mode === 'dark' ? token.dark : token.light
  if (!ref) return null
  return resolveRef(ref, palettes)
}

// Returns a flat map of tokenId → hex for a given mode — used by the preview
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

// Returns true if a TokenRef points to a palette/step that no longer exists
export function isBrokenRef(ref: TokenRef, palettes: Palette[]): boolean {
  return resolveRef(ref, palettes) === null
}
