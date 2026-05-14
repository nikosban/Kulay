export interface LightnessRange {
  lightest: number  // L of the lightest step in light mode (default 0.96)
  darkest: number   // L of the darkest step in light mode (default 0.12)
}

export const DEFAULT_LIGHTNESS_RANGE: LightnessRange = { lightest: 0.96, darkest: 0.12 }

// ── Palette generation presets ────────────────────────────────────────────────

export type PalettePreset = 'balanced' | 'vivid' | 'muted' | 'soft' | 'high-contrast' | 'manual'

export interface PresetConfig {
  label: string
  lightnessRange: LightnessRange
  envelopeExponent: number
  lightnessDistribution: 'linear' | 'perceptual'
}

export const PALETTE_PRESETS: Record<Exclude<PalettePreset, 'manual'>, PresetConfig> = {
  balanced:        { label: 'Balanced',       lightnessRange: { lightest: 0.97, darkest: 0.12 }, envelopeExponent: 0.75, lightnessDistribution: 'linear' },
  vivid:           { label: 'Vivid',          lightnessRange: { lightest: 0.95, darkest: 0.15 }, envelopeExponent: 0.55, lightnessDistribution: 'linear' },
  muted:           { label: 'Muted',          lightnessRange: { lightest: 0.97, darkest: 0.12 }, envelopeExponent: 1.10, lightnessDistribution: 'perceptual' },
  soft:            { label: 'Soft',           lightnessRange: { lightest: 0.98, darkest: 0.30 }, envelopeExponent: 0.85, lightnessDistribution: 'perceptual' },
  'high-contrast': { label: 'High contrast',  lightnessRange: { lightest: 0.99, darkest: 0.05 }, envelopeExponent: 0.70, lightnessDistribution: 'linear' },
}

export const DEFAULT_PRESET: PalettePreset = 'balanced'

export type LabelScale = '0-10' | '0-100' | '0-1000'
export const DEFAULT_LABEL_SCALE: LabelScale = '0-1000'

export interface Project {
  id: string
  name: string
  stepCount: number
  backgrounds: {
    light: string
    dark: string
  }
  lightnessRange: LightnessRange
  labelScale?: LabelScale
  envelopeExponent?: number               // 0.4–1.4, default 0.75; controls chroma envelope shape
  lightnessDistribution?: 'linear' | 'perceptual'  // default 'linear'
  palettes: Palette[]
  theme?: import('./tokens').Theme
  createdAt: number
  updatedAt: number
}

export interface Palette {
  id: string
  name: string
  baseHex: string
  preset?: PalettePreset                        // default 'balanced'
  lightnessRange?: LightnessRange               // only used when preset === 'manual'
  envelopeExponent?: number                     // only used when preset === 'manual'
  lightnessDistribution?: 'linear' | 'perceptual'  // only used when preset === 'manual'
  activeMode: 'light' | 'dark'
  modes: {
    light: PaletteStep[]
    dark: PaletteStep[] | null
  }
}

export interface PaletteStep {
  label: number
  hex: string
  isBase: boolean
  locked: boolean
  oklch: { l: number; c: number; h: number }
  contrast: {
    onLight: number
    onDark: number
  }
}

export function getActiveSteps(palette: Palette): PaletteStep[] {
  return (palette.activeMode === 'dark' ? palette.modes.dark : null) ?? palette.modes.light
}
