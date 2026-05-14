import type { Palette } from '../types/project'
import type { Theme, TokenGroup, TokenRef } from '../types/tokens'
import { DEFAULT_TOKEN_GROUPS } from '../types/tokens'
import { getActiveSteps } from '../types/project'
import { hexToOklch } from './color'

// ── Palette role classification ───────────────────────────────────────────────

type PaletteRole = 'brand' | 'neutral' | 'danger' | 'success' | 'warning' | 'info' | 'unknown'

function classifyPalette(palette: Palette): { role: PaletteRole; hue: number; chroma: number } {
  const steps = getActiveSteps(palette)
  // Use mid-range steps for classification (avoid near-white/near-black extremes)
  const mid = steps.slice(Math.floor(steps.length * 0.2), Math.ceil(steps.length * 0.8))
  const avgH = mid.reduce((s, st) => s + hexToOklch(st.hex)[2], 0) / mid.length
  const avgC = mid.reduce((s, st) => s + hexToOklch(st.hex)[1], 0) / mid.length

  let role: PaletteRole = 'unknown'
  if (avgC < 0.04) {
    role = 'neutral'
  } else if ((avgH >= 0 && avgH <= 25) || avgH >= 345) {
    role = 'danger'
  } else if (avgH >= 26 && avgH <= 75) {
    role = 'warning'
  } else if (avgH >= 76 && avgH <= 170) {
    role = 'success'
  } else if (avgH >= 200 && avgH <= 270) {
    role = 'info'
  } else {
    role = 'brand'
  }

  return { role, hue: avgH, chroma: avgC }
}

// ── Step selectors ────────────────────────────────────────────────────────────

function stepAtFraction(palette: Palette, fraction: number): TokenRef {
  const steps = getActiveSteps(palette)
  const idx = Math.round(fraction * (steps.length - 1))
  return { paletteId: palette.id, stepLabel: steps[Math.max(0, Math.min(idx, steps.length - 1))]!.label }
}

function stepNearest(palette: Palette, targetL: number): TokenRef {
  const steps = getActiveSteps(palette)
  let best = steps[0]!
  let bestDiff = Infinity
  for (const s of steps) {
    const [l] = hexToOklch(s.hex)
    const diff = Math.abs(l - targetL)
    if (diff < bestDiff) { bestDiff = diff; best = s }
  }
  return { paletteId: palette.id, stepLabel: best.label }
}

// ── Main suggest function ─────────────────────────────────────────────────────

export function suggestTheme(palettes: Palette[]): Theme {
  if (palettes.length === 0) return { groups: DEFAULT_TOKEN_GROUPS.map(g => ({ ...g, tokens: g.tokens.map(t => ({ ...t })) })) }

  // Classify all palettes
  const classified = palettes.map((p) => ({ palette: p, ...classifyPalette(p) }))

  // Find best palette per role — most chromatic wins for non-neutral roles
  const byRole = (role: PaletteRole) =>
    classified
      .filter((c) => c.role === role)
      .sort((a, b) => b.chroma - a.chroma)[0]?.palette ?? null

  // Neutral: lowest average chroma
  const neutral =
    classified
      .filter((c) => c.role === 'neutral')
      .sort((a, b) => a.chroma - b.chroma)[0]?.palette ??
    classified.sort((a, b) => a.chroma - b.chroma)[0]!.palette

  // Brand: most chromatic non-feedback palette
  const brand =
    classified
      .filter((c) => !['neutral', 'danger', 'success', 'warning', 'info'].includes(c.role))
      .sort((a, b) => b.chroma - a.chroma)[0]?.palette ??
    classified.sort((a, b) => b.chroma - a.chroma)[0]!.palette

  const danger  = byRole('danger')
  const success = byRole('success')
  const warning = byRole('warning')
  const info    = byRole('info')

  function ref(p: Palette | null, fraction: number): TokenRef | null {
    return p ? stepAtFraction(p, fraction) : null
  }
  function refL(p: Palette | null, targetL: number): TokenRef | null {
    return p ? stepNearest(p, targetL) : null
  }

  // Build token map: tokenId → { light, dark }
  const map: Record<string, { light: TokenRef | null; dark: TokenRef | null }> = {
    // Brand
    'brand/primary':        { light: refL(brand, 0.50),  dark: refL(brand, 0.65) },
    'brand/primary-hover':  { light: refL(brand, 0.40),  dark: refL(brand, 0.55) },
    'brand/primary-subtle': { light: ref(brand, 0.08),   dark: ref(brand, 0.15) },
    'brand/on-primary':     { light: ref(neutral, 0.98), dark: ref(neutral, 0.98) },

    // Surface (from neutral)
    'surface/page':    { light: ref(neutral, 0.02), dark: ref(neutral, 0.95) },
    'surface/raised':  { light: ref(neutral, 0.0),  dark: ref(neutral, 0.88) },
    'surface/sunken':  { light: ref(neutral, 0.08), dark: ref(neutral, 1.0) },
    'surface/overlay': { light: ref(neutral, 0.92), dark: ref(neutral, 1.0) },

    // Text (from neutral)
    'text/primary':     { light: ref(neutral, 0.92), dark: ref(neutral, 0.05) },
    'text/secondary':   { light: ref(neutral, 0.75), dark: ref(neutral, 0.20) },
    'text/placeholder': { light: ref(neutral, 0.55), dark: ref(neutral, 0.40) },
    'text/on-brand':    { light: ref(neutral, 0.02), dark: ref(neutral, 0.02) },

    // Border
    'border/default': { light: ref(neutral, 0.18), dark: ref(neutral, 0.78) },
    'border/strong':  { light: ref(neutral, 0.35), dark: ref(neutral, 0.62) },

    // Feedback
    'feedback/danger':  { light: refL(danger,  0.48), dark: refL(danger,  0.62) },
    'feedback/success': { light: refL(success, 0.48), dark: refL(success, 0.62) },
    'feedback/warning': { light: refL(warning, 0.55), dark: refL(warning, 0.68) },
    'feedback/info':    { light: refL(info,    0.50), dark: refL(info,    0.65) },
  }

  // Clone DEFAULT_TOKEN_GROUPS and fill in suggestions
  const groups: TokenGroup[] = DEFAULT_TOKEN_GROUPS.map((g) => ({
    ...g,
    tokens: g.tokens.map((t) => ({
      ...t,
      light: map[t.id]?.light ?? null,
      dark:  map[t.id]?.dark  ?? null,
    })),
  }))

  return { groups }
}
