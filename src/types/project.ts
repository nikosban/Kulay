export interface LightnessRange {
  lightest: number  // L of the lightest step in light mode (default 0.96)
  darkest: number   // L of the darkest step in light mode (default 0.12)
}

export const DEFAULT_LIGHTNESS_RANGE: LightnessRange = { lightest: 0.96, darkest: 0.12 }

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
  labelScale?: LabelScale   // optional for backward compat; defaults to '0-1000'
  palettes: Palette[]
  createdAt: number
  updatedAt: number
}

export interface Palette {
  id: string
  name: string
  baseHex: string
  lightnessRange?: LightnessRange   // per-palette override; falls back to project default
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
