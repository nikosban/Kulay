export interface TokenRef {
  paletteId: string
  stepLabel: number
}

export interface ThemeToken {
  id: string
  name: string         // e.g. "brand/primary"
  description: string
  light: TokenRef | null
  dark: TokenRef | null
}

export interface TokenGroup {
  id: string
  name: string         // e.g. "Brand", "Surface"
  tokens: ThemeToken[]
}

export interface Theme {
  groups: TokenGroup[]
}

export const DEFAULT_TOKEN_GROUPS: TokenGroup[] = [
  {
    id: 'brand',
    name: 'Brand',
    tokens: [
      { id: 'brand/primary',        name: 'brand/primary',        description: 'Main brand action color',            light: null, dark: null },
      { id: 'brand/primary-hover',  name: 'brand/primary-hover',  description: 'Brand color on hover',               light: null, dark: null },
      { id: 'brand/primary-subtle', name: 'brand/primary-subtle', description: 'Light tint for brand backgrounds',   light: null, dark: null },
      { id: 'brand/on-primary',     name: 'brand/on-primary',     description: 'Text/icon color on brand surfaces',  light: null, dark: null },
    ],
  },
  {
    id: 'surface',
    name: 'Surface',
    tokens: [
      { id: 'surface/page',    name: 'surface/page',    description: 'Main page background',           light: null, dark: null },
      { id: 'surface/raised',  name: 'surface/raised',  description: 'Cards, panels, elevated areas',  light: null, dark: null },
      { id: 'surface/sunken',  name: 'surface/sunken',  description: 'Inset areas, inputs',            light: null, dark: null },
      { id: 'surface/overlay', name: 'surface/overlay', description: 'Modals, popovers',               light: null, dark: null },
    ],
  },
  {
    id: 'text',
    name: 'Text',
    tokens: [
      { id: 'text/primary',     name: 'text/primary',     description: 'Primary body text',         light: null, dark: null },
      { id: 'text/secondary',   name: 'text/secondary',   description: 'Secondary / supporting text', light: null, dark: null },
      { id: 'text/placeholder', name: 'text/placeholder', description: 'Placeholder and hint text', light: null, dark: null },
      { id: 'text/on-brand',    name: 'text/on-brand',    description: 'Text on brand color surfaces', light: null, dark: null },
    ],
  },
  {
    id: 'border',
    name: 'Border',
    tokens: [
      { id: 'border/default', name: 'border/default', description: 'Default border and dividers',  light: null, dark: null },
      { id: 'border/strong',  name: 'border/strong',  description: 'Emphasized borders and focus', light: null, dark: null },
    ],
  },
  {
    id: 'feedback',
    name: 'Feedback',
    tokens: [
      { id: 'feedback/danger',  name: 'feedback/danger',  description: 'Errors and destructive actions', light: null, dark: null },
      { id: 'feedback/success', name: 'feedback/success', description: 'Success and confirmation',       light: null, dark: null },
      { id: 'feedback/warning', name: 'feedback/warning', description: 'Warnings and caution',           light: null, dark: null },
      { id: 'feedback/info',    name: 'feedback/info',    description: 'Informational messages',         light: null, dark: null },
    ],
  },
]
