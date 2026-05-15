import type { Palette, PaletteStep } from '../types/project'
import type { Theme, TokenGroup, TokenRef } from '../types/tokens'
import { DEFAULT_TOKEN_GROUPS } from '../types/tokens'
import { hexToOklch } from './color'
import { contrastRatio } from './wcag'

// ── Palette role classification ───────────────────────────────────────────────

export type PaletteRole = 'brand' | 'neutral' | 'danger' | 'success' | 'warning' | 'informative' | 'discovery' | 'unknown'

function classifyPalette(palette: Palette): { role: PaletteRole; hue: number; chroma: number } {
  const steps = palette.modes.light
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
  } else if (avgH >= 171 && avgH <= 230) {
    role = 'informative'
  } else {
    role = 'brand'
  }

  return { role, hue: avgH, chroma: avgC }
}

// ── Step helpers ──────────────────────────────────────────────────────────────

function getModeSteps(palette: Palette, mode: 'light' | 'dark'): PaletteStep[] {
  return (mode === 'dark' ? palette.modes.dark : null) ?? palette.modes.light
}

function stepNearest(palette: Palette, targetL: number, mode: 'light' | 'dark'): TokenRef {
  const steps = getModeSteps(palette, mode)
  let best = steps[0]!
  let bestDiff = Infinity
  for (const s of steps) {
    const [l] = hexToOklch(s.hex)
    const diff = Math.abs(l - targetL)
    if (diff < bestDiff) { bestDiff = diff; best = s }
  }
  return { paletteId: palette.id, stepLabel: best.label }
}

function stepHex(palette: Palette, targetL: number, mode: 'light' | 'dark'): string {
  const steps = getModeSteps(palette, mode)
  const r = stepNearest(palette, targetL, mode)
  return steps.find((s) => s.label === r.stepLabel)?.hex ?? '#888888'
}

// Pick step closest to targetL that achieves minContrast against bgHex.
// Falls back to highest-contrast step if nothing passes.
function stepContrast(
  palette: Palette,
  targetL: number,
  bgHex: string,
  minContrast: number,
  mode: 'light' | 'dark',
): TokenRef {
  const steps = getModeSteps(palette, mode)
  const nearest = stepNearest(palette, targetL, mode)
  const nearestHex = steps.find((s) => s.label === nearest.stepLabel)!.hex
  if (contrastRatio(nearestHex, bgHex) >= minContrast) return nearest

  const sorted = [...steps].sort((a, b) => {
    const [la] = hexToOklch(a.hex)
    const [lb] = hexToOklch(b.hex)
    return Math.abs(la - targetL) - Math.abs(lb - targetL)
  })

  let bestStep = sorted[0]!
  let bestRatio = 0
  for (const step of sorted) {
    const ratio = contrastRatio(step.hex, bgHex)
    if (ratio > bestRatio) { bestRatio = ratio; bestStep = step }
    if (ratio >= minContrast) return { paletteId: palette.id, stepLabel: step.label }
  }
  return { paletteId: palette.id, stepLabel: bestStep.label }
}

function ref(p: Palette | null, l: number, mode: 'light' | 'dark'): TokenRef | null {
  return p ? stepNearest(p, l, mode) : null
}

// Pick the neutral step that contrasts best against a given background hex
function onSurface(neutral: Palette, bgHex: string, mode: 'light' | 'dark'): TokenRef {
  const steps = getModeSteps(neutral, mode)
  const lightest = steps[0]!
  const darkest  = steps[steps.length - 1]!
  return contrastRatio(lightest.hex, bgHex) >= contrastRatio(darkest.hex, bgHex)
    ? { paletteId: neutral.id, stepLabel: lightest.label }
    : { paletteId: neutral.id, stepLabel: darkest.label }
}

// ── Role hue targets ─────────────────────────────────────────────────────────

export function getTargetHueForRole(role: PaletteRole, brandHue: number | null): number {
  // Hues must fall inside classifyPalette's ranges:
  //   danger 0–25 | warning 26–75 | success 76–170 | informative 171–230 | brand 231–344
  switch (role) {
    case 'danger':      return 10   // red
    case 'warning':     return 55   // amber/yellow
    case 'success':     return 135  // green
    case 'informative': return 210  // blue
    case 'discovery':   return brandHue != null ? (brandHue + 180) % 360 : 280
    default:            return 270  // purple fallback for brand
  }
}

export function getBrandHueFromPalettes(palettes: Palette[]): number | null {
  if (palettes.length === 0) return null
  const classified = palettes.map((p) => ({ palette: p, ...classifyPalette(p) }))
  const brand = classified
    .filter((c) => !['neutral', 'danger', 'success', 'warning', 'informative'].includes(c.role))
    .sort((a, b) => b.chroma - a.chroma)[0]
  if (!brand || brand.chroma < 0.08) return null
  return brand.hue
}

// ── Discovery palette detection ───────────────────────────────────────────────

// Returns missing roles so the editor can flag them
export type SuggestResult = { theme: Theme; missingRoles: PaletteRole[] }

function findDiscovery(
  classified: { palette: Palette; role: PaletteRole; hue: number; chroma: number }[],
  brandHue: number,
): Palette | null {
  const target = (brandHue + 180) % 360
  const HUE_TOLERANCE = 50
  return classified
    .filter((c) => c.role !== 'neutral' && c.chroma >= 0.04)
    .map((c) => ({ ...c, dist: Math.min(Math.abs(c.hue - target), 360 - Math.abs(c.hue - target)) }))
    .filter((c) => c.dist <= HUE_TOLERANCE)
    .sort((a, b) => a.dist - b.dist)[0]?.palette ?? null
}

// ── Main suggest ──────────────────────────────────────────────────────────────

export function suggestTheme(
  palettes: Palette[],
  roleOverrides: Partial<Record<PaletteRole, string>> = {},
): SuggestResult {
  const emptyTheme: Theme = {
    groups: DEFAULT_TOKEN_GROUPS.map((g) => ({
      ...g,
      tokens: g.tokens.map((t) => ({ ...t })),
    })),
  }
  if (palettes.length === 0) return { theme: emptyTheme, missingRoles: [] }

  const classified = palettes.map((p) => ({ palette: p, ...classifyPalette(p) }))

  const byRole = (role: PaletteRole) =>
    classified.filter((c) => c.role === role).sort((a, b) => b.chroma - a.chroma)[0]?.palette ?? null

  // If an override is provided for a role, use that palette; otherwise fall back to classified result.
  function pick(role: PaletteRole, fallback: Palette | null): Palette | null {
    const id = roleOverrides[role]
    return id ? (palettes.find((p) => p.id === id) ?? fallback) : fallback
  }

  const classifiedNeutral =
    classified.filter((c) => c.role === 'neutral').sort((a, b) => a.chroma - b.chroma)[0]?.palette ??
    classified.sort((a, b) => a.chroma - b.chroma)[0]!.palette

  const classifiedBrand =
    classified
      .filter((c) => !['neutral', 'danger', 'success', 'warning', 'informative'].includes(c.role))
      .sort((a, b) => b.chroma - a.chroma)[0]?.palette ??
    classified.sort((a, b) => b.chroma - a.chroma)[0]!.palette

  const neutral = pick('neutral', classifiedNeutral) ?? classifiedNeutral
  const brand   = pick('brand',   classifiedBrand)   ?? classifiedBrand
  const brandHue = classified.find((c) => c.palette.id === brand.id)?.hue ?? 0

  const danger      = pick('danger',      byRole('danger'))
  const success     = pick('success',     byRole('success'))
  const warning     = pick('warning',     byRole('warning'))
  const informative = pick('informative', byRole('informative'))
  const discovery   = pick('discovery',   findDiscovery(classified, brandHue))

  const missingRoles: PaletteRole[] = []
  if (!discovery) missingRoles.push('discovery')
  if (!danger)    missingRoles.push('danger')
  if (!success)   missingRoles.push('success')
  if (!warning)   missingRoles.push('warning')
  if (!informative) missingRoles.push('informative')

  // ── Surface L targets ─────────────────────────────────────────────────────
  // Neutral  light: high L = near-white;  dark: low L = near-black
  // Semantic light: subtle=very-light-tint, base=medium-tint, strong=solid-color
  //          dark:  subtle=dark-tint, base=medium-dark, strong=lighter-solid

  // Pre-resolve background hexes for contrast checking
  const neutralBaseLightHex = stepHex(neutral, 0.96, 'light')
  const neutralBaseDarkHex  = stepHex(neutral, 0.14, 'dark')

  function surfaceSubtleLightHex(p: Palette | null): string {
    return p ? stepHex(p, 0.94, 'light') : '#eeeeee'
  }
  function surfaceSubtleDarkHex(p: Palette | null): string {
    return p ? stepHex(p, 0.22, 'dark') : '#222222'
  }

  const map: Record<string, { light: TokenRef | null; dark: TokenRef | null }> = {

    // ── Surface/neutral ──────────────────────────────────────────────────────
    'surface/neutral/subtle':  { light: ref(neutral, 0.985, 'light'), dark: ref(neutral, 0.185, 'dark') },
    'surface/neutral/base':    { light: ref(neutral, 0.96,  'light'), dark: ref(neutral, 0.14,  'dark') },
    'surface/neutral/muted':   { light: ref(neutral, 0.93,  'light'), dark: ref(neutral, 0.10,  'dark') },
    'surface/neutral/strong':  { light: ref(neutral, 0.25,  'light'), dark: ref(neutral, 0.82,  'dark') },

    // ── Surface/brand ────────────────────────────────────────────────────────
    'surface/brand/subtle':  { light: ref(brand, 0.94, 'light'), dark: ref(brand, 0.22, 'dark') },
    'surface/brand/base':    { light: ref(brand, 0.86, 'light'), dark: ref(brand, 0.32, 'dark') },
    'surface/brand/strong':  { light: ref(brand, 0.50, 'light'), dark: ref(brand, 0.68, 'dark') },

    // ── Surface/discovery ────────────────────────────────────────────────────
    'surface/discovery/subtle':  { light: ref(discovery, 0.94, 'light'), dark: ref(discovery, 0.22, 'dark') },
    'surface/discovery/base':    { light: ref(discovery, 0.86, 'light'), dark: ref(discovery, 0.32, 'dark') },
    'surface/discovery/strong':  { light: ref(discovery, 0.50, 'light'), dark: ref(discovery, 0.68, 'dark') },

    // ── Surface/danger ───────────────────────────────────────────────────────
    'surface/danger/subtle':  { light: ref(danger, 0.94, 'light'), dark: ref(danger, 0.22, 'dark') },
    'surface/danger/base':    { light: ref(danger, 0.86, 'light'), dark: ref(danger, 0.32, 'dark') },
    'surface/danger/strong':  { light: ref(danger, 0.50, 'light'), dark: ref(danger, 0.65, 'dark') },

    // ── Surface/success ──────────────────────────────────────────────────────
    'surface/success/subtle':  { light: ref(success, 0.94, 'light'), dark: ref(success, 0.22, 'dark') },
    'surface/success/base':    { light: ref(success, 0.86, 'light'), dark: ref(success, 0.32, 'dark') },
    'surface/success/strong':  { light: ref(success, 0.50, 'light'), dark: ref(success, 0.65, 'dark') },

    // ── Surface/warning ──────────────────────────────────────────────────────
    'surface/warning/subtle':  { light: ref(warning, 0.94, 'light'), dark: ref(warning, 0.22, 'dark') },
    'surface/warning/base':    { light: ref(warning, 0.86, 'light'), dark: ref(warning, 0.32, 'dark') },
    'surface/warning/strong':  { light: ref(warning, 0.55, 'light'), dark: ref(warning, 0.68, 'dark') },

    // ── Surface/informative ──────────────────────────────────────────────────
    'surface/informative/subtle':  { light: ref(informative, 0.94, 'light'), dark: ref(informative, 0.22, 'dark') },
    'surface/informative/base':    { light: ref(informative, 0.86, 'light'), dark: ref(informative, 0.32, 'dark') },
    'surface/informative/strong':  { light: ref(informative, 0.50, 'light'), dark: ref(informative, 0.65, 'dark') },

    // ── Interactive/brand ────────────────────────────────────────────────────
    'interactive/brand/rest':     { light: ref(brand, 0.50, 'light'), dark: ref(brand, 0.68, 'dark') },
    'interactive/brand/hover':    { light: ref(brand, 0.43, 'light'), dark: ref(brand, 0.74, 'dark') },
    'interactive/brand/active':   { light: ref(brand, 0.36, 'light'), dark: ref(brand, 0.80, 'dark') },
    'interactive/brand/selected': { light: ref(brand, 0.56, 'light'), dark: ref(brand, 0.62, 'dark') },

    // ── Interactive/neutral ──────────────────────────────────────────────────
    'interactive/neutral/rest':     { light: ref(neutral, 0.93, 'light'), dark: ref(neutral, 0.20, 'dark') },
    'interactive/neutral/hover':    { light: ref(neutral, 0.89, 'light'), dark: ref(neutral, 0.25, 'dark') },
    'interactive/neutral/active':   { light: ref(neutral, 0.84, 'light'), dark: ref(neutral, 0.30, 'dark') },
    'interactive/neutral/selected': { light: ref(neutral, 0.91, 'light'), dark: ref(neutral, 0.22, 'dark') },

    // ── Interactive/danger ───────────────────────────────────────────────────
    'interactive/danger/rest':     { light: ref(danger, 0.50, 'light'), dark: ref(danger, 0.65, 'dark') },
    'interactive/danger/hover':    { light: ref(danger, 0.43, 'light'), dark: ref(danger, 0.71, 'dark') },
    'interactive/danger/active':   { light: ref(danger, 0.36, 'light'), dark: ref(danger, 0.77, 'dark') },
    'interactive/danger/selected': { light: ref(danger, 0.56, 'light'), dark: ref(danger, 0.59, 'dark') },

    // ── Interactive/discovery ────────────────────────────────────────────────
    'interactive/discovery/rest':     { light: ref(discovery, 0.50, 'light'), dark: ref(discovery, 0.68, 'dark') },
    'interactive/discovery/hover':    { light: ref(discovery, 0.43, 'light'), dark: ref(discovery, 0.74, 'dark') },
    'interactive/discovery/active':   { light: ref(discovery, 0.36, 'light'), dark: ref(discovery, 0.80, 'dark') },
    'interactive/discovery/selected': { light: ref(discovery, 0.56, 'light'), dark: ref(discovery, 0.62, 'dark') },

    // ── Interactive/disabled ─────────────────────────────────────────────────
    'interactive/disabled/rest': { light: ref(neutral, 0.91, 'light'), dark: ref(neutral, 0.22, 'dark') },

    // ── Foreground (structural) ───────────────────────────────────────────────
    'fg/headline': {
      light: stepContrast(neutral, 0.10, neutralBaseLightHex, 7.0, 'light'),
      dark:  stepContrast(neutral, 0.95, neutralBaseDarkHex,  7.0, 'dark'),
    },
    'fg/base': {
      light: stepContrast(neutral, 0.18, neutralBaseLightHex, 7.0, 'light'),
      dark:  stepContrast(neutral, 0.90, neutralBaseDarkHex,  7.0, 'dark'),
    },
    'fg/muted': {
      light: stepContrast(neutral, 0.38, neutralBaseLightHex, 4.5, 'light'),
      dark:  stepContrast(neutral, 0.72, neutralBaseDarkHex,  4.5, 'dark'),
    },
    'fg/placeholder': {
      light: stepContrast(neutral, 0.55, neutralBaseLightHex, 3.0, 'light'),
      dark:  stepContrast(neutral, 0.54, neutralBaseDarkHex,  3.0, 'dark'),
    },
    'fg/inverted': {
      light: ref(neutral, 0.985, 'light'),
      dark:  ref(neutral, 0.12,  'dark'),
    },
    'fg/disabled': {
      light: ref(neutral, 0.62, 'light'),
      dark:  ref(neutral, 0.40, 'dark'),
    },
    'fg/on-brand': {
      light: (() => { const h = stepHex(brand, 0.50, 'light'); return { paletteId: neutral.id, stepLabel: onSurface(neutral, h, 'light').stepLabel } })(),
      dark:  (() => { const h = stepHex(brand, 0.68, 'dark');  return { paletteId: neutral.id, stepLabel: onSurface(neutral, h, 'dark').stepLabel }  })(),
    },

    // ── Foreground (semantic utility) ────────────────────────────────────────
    // /base = text on neutral/base surface
    // /alt  = text on the semantic/subtle surface (needs separate contrast check)
    'fg/brand/base': {
      light: stepContrast(brand, 0.42, neutralBaseLightHex,           4.5, 'light'),
      dark:  stepContrast(brand, 0.72, neutralBaseDarkHex,            4.5, 'dark'),
    },
    'fg/brand/alt': {
      light: stepContrast(brand, 0.38, surfaceSubtleLightHex(brand),  4.5, 'light'),
      dark:  stepContrast(brand, 0.76, surfaceSubtleDarkHex(brand),   4.5, 'dark'),
    },
    'fg/success/base': {
      light: stepContrast(success ?? neutral, 0.40, neutralBaseLightHex,              4.5, 'light'),
      dark:  stepContrast(success ?? neutral, 0.70, neutralBaseDarkHex,               4.5, 'dark'),
    },
    'fg/success/alt': {
      light: stepContrast(success ?? neutral, 0.36, surfaceSubtleLightHex(success),   4.5, 'light'),
      dark:  stepContrast(success ?? neutral, 0.74, surfaceSubtleDarkHex(success),    4.5, 'dark'),
    },
    'fg/danger/base': {
      light: stepContrast(danger ?? neutral, 0.40, neutralBaseLightHex,               4.5, 'light'),
      dark:  stepContrast(danger ?? neutral, 0.70, neutralBaseDarkHex,                4.5, 'dark'),
    },
    'fg/danger/alt': {
      light: stepContrast(danger ?? neutral, 0.36, surfaceSubtleLightHex(danger),     4.5, 'light'),
      dark:  stepContrast(danger ?? neutral, 0.74, surfaceSubtleDarkHex(danger),      4.5, 'dark'),
    },
    'fg/warning/base': {
      light: stepContrast(warning ?? neutral, 0.42, neutralBaseLightHex,              4.5, 'light'),
      dark:  stepContrast(warning ?? neutral, 0.72, neutralBaseDarkHex,               4.5, 'dark'),
    },
    'fg/warning/alt': {
      light: stepContrast(warning ?? neutral, 0.38, surfaceSubtleLightHex(warning),   4.5, 'light'),
      dark:  stepContrast(warning ?? neutral, 0.76, surfaceSubtleDarkHex(warning),    4.5, 'dark'),
    },
    'fg/informative/base': {
      light: stepContrast(informative ?? neutral, 0.42, neutralBaseLightHex,              4.5, 'light'),
      dark:  stepContrast(informative ?? neutral, 0.72, neutralBaseDarkHex,               4.5, 'dark'),
    },
    'fg/informative/alt': {
      light: stepContrast(informative ?? neutral, 0.38, surfaceSubtleLightHex(informative), 4.5, 'light'),
      dark:  stepContrast(informative ?? neutral, 0.76, surfaceSubtleDarkHex(informative),  4.5, 'dark'),
    },
    'fg/discovery/base': {
      light: stepContrast(discovery ?? neutral, 0.42, neutralBaseLightHex,               4.5, 'light'),
      dark:  stepContrast(discovery ?? neutral, 0.72, neutralBaseDarkHex,                4.5, 'dark'),
    },
    'fg/discovery/alt': {
      light: stepContrast(discovery ?? neutral, 0.38, surfaceSubtleLightHex(discovery),  4.5, 'light'),
      dark:  stepContrast(discovery ?? neutral, 0.76, surfaceSubtleDarkHex(discovery),   4.5, 'dark'),
    },

    // ── Border ───────────────────────────────────────────────────────────────
    'border/default':     { light: ref(neutral, 0.86, 'light'), dark: ref(neutral, 0.28, 'dark') },
    'border/strong':      { light: ref(neutral, 0.72, 'light'), dark: ref(neutral, 0.45, 'dark') },
    'border/subtle':      { light: ref(neutral, 0.93, 'light'), dark: ref(neutral, 0.20, 'dark') },
    'border/brand':       { light: ref(brand,       0.50, 'light'), dark: ref(brand,       0.68, 'dark') },
    'border/danger':      { light: ref(danger,      0.50, 'light'), dark: ref(danger,      0.65, 'dark') },
    'border/success':     { light: ref(success,     0.50, 'light'), dark: ref(success,     0.65, 'dark') },
    'border/warning':     { light: ref(warning,     0.55, 'light'), dark: ref(warning,     0.68, 'dark') },
    'border/informative': { light: ref(informative, 0.50, 'light'), dark: ref(informative, 0.65, 'dark') },
    'border/discovery':   { light: ref(discovery,   0.50, 'light'), dark: ref(discovery,   0.68, 'dark') },
    'border/disabled':    { light: ref(neutral, 0.82, 'light'), dark: ref(neutral, 0.28, 'dark') },

    // ── Focus ────────────────────────────────────────────────────────────────
    'focus/ring': { light: ref(brand, 0.50, 'light'), dark: ref(brand, 0.68, 'dark') },
  }

  const groups: TokenGroup[] = DEFAULT_TOKEN_GROUPS.map((g) => ({
    ...g,
    tokens: g.tokens.map((t) => ({
      ...t,
      light: map[t.id]?.light ?? null,
      dark:  map[t.id]?.dark  ?? null,
    })),
  }))

  return { theme: { groups }, missingRoles }
}
