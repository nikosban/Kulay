export interface TokenRef {
  paletteId: string
  stepLabel: number
}

export interface ThemeToken {
  id: string
  name: string
  description: string
  light: TokenRef | null
  dark:  TokenRef | null
}

export interface TokenGroup {
  id: string
  name: string
  description: string
  tokens: ThemeToken[]
}

export interface Theme {
  groups: TokenGroup[]
}

function tok(id: string, description: string): ThemeToken {
  return { id, name: id, description, light: null, dark: null }
}

function group(id: string, name: string, description: string, tokens: ThemeToken[]): TokenGroup {
  return { id, name, description, tokens }
}

export const DEFAULT_TOKEN_GROUPS: TokenGroup[] = [
  group('surface', 'Surface', 'Background colors for UI layers and semantic containers', [
    // Neutral
    tok('surface/neutral/subtle',  'Subtle background — cards, panels'),
    tok('surface/neutral/base',    'Default page background'),
    tok('surface/neutral/muted',   'Inset / sunken areas (inputs, code blocks)'),
    tok('surface/neutral/strong',  'Prominent areas (sidebars, nav, high-contrast fills)'),
    // Brand
    tok('surface/brand/subtle',    'Light brand tint — selected rows, badges'),
    tok('surface/brand/base',      'Medium brand fill — section backgrounds'),
    tok('surface/brand/strong',    'Solid brand fill — primary button background'),
    // Discovery (complement of brand)
    tok('surface/discovery/subtle',  'Light discovery tint'),
    tok('surface/discovery/base',    'Medium discovery fill'),
    tok('surface/discovery/strong',  'Solid discovery fill'),
    // Semantic
    tok('surface/danger/subtle',     'Danger tint — error backgrounds'),
    tok('surface/danger/base',       'Medium danger fill'),
    tok('surface/danger/strong',     'Solid danger fill'),
    tok('surface/success/subtle',    'Success tint — confirmation backgrounds'),
    tok('surface/success/base',      'Medium success fill'),
    tok('surface/success/strong',    'Solid success fill'),
    tok('surface/warning/subtle',    'Warning tint — caution backgrounds'),
    tok('surface/warning/base',      'Medium warning fill'),
    tok('surface/warning/strong',    'Solid warning fill'),
    tok('surface/informative/subtle', 'Informative tint — info backgrounds'),
    tok('surface/informative/base',   'Medium informative fill'),
    tok('surface/informative/strong', 'Solid informative fill'),
  ]),

  group('interactive', 'Interactive', 'Background colors for interactive elements with full state coverage', [
    tok('interactive/brand/rest',       'Brand interactive — default state'),
    tok('interactive/brand/hover',      'Brand interactive — hovered'),
    tok('interactive/brand/active',     'Brand interactive — pressed'),
    tok('interactive/brand/selected',   'Brand interactive — selected/on'),
    tok('interactive/neutral/rest',     'Neutral interactive — default state'),
    tok('interactive/neutral/hover',    'Neutral interactive — hovered'),
    tok('interactive/neutral/active',   'Neutral interactive — pressed'),
    tok('interactive/neutral/selected', 'Neutral interactive — selected/on'),
    tok('interactive/danger/rest',      'Danger interactive — default state'),
    tok('interactive/danger/hover',     'Danger interactive — hovered'),
    tok('interactive/danger/active',    'Danger interactive — pressed'),
    tok('interactive/danger/selected',  'Danger interactive — selected/on'),
    tok('interactive/discovery/rest',     'Discovery interactive — default state'),
    tok('interactive/discovery/hover',    'Discovery interactive — hovered'),
    tok('interactive/discovery/active',   'Discovery interactive — pressed'),
    tok('interactive/discovery/selected', 'Discovery interactive — selected/on'),
    tok('interactive/disabled/rest',    'Shared disabled background — all colors'),
  ]),

  group('fg', 'Foreground', 'Text and icon colors', [
    // Structural
    tok('fg/headline',     'Headings and highest-emphasis text'),
    tok('fg/base',         'Default body text'),
    tok('fg/muted',        'Secondary / supporting text'),
    tok('fg/placeholder',  'Placeholder and hint text'),
    tok('fg/inverted',     'Text on dark or strong surfaces'),
    tok('fg/disabled',     'Disabled text and icons'),
    tok('fg/on-brand',     'Text / icons on brand/strong surfaces'),
    // Semantic utility — base = on default bg, alt = on its own subtle surface
    tok('fg/brand/base',        'Brand text on default background'),
    tok('fg/brand/alt',         'Brand text on surface/brand/subtle'),
    tok('fg/success/base',      'Success text on default background'),
    tok('fg/success/alt',       'Success text on surface/success/subtle'),
    tok('fg/danger/base',       'Danger text on default background'),
    tok('fg/danger/alt',        'Danger text on surface/danger/subtle'),
    tok('fg/warning/base',      'Warning text on default background'),
    tok('fg/warning/alt',       'Warning text on surface/warning/subtle'),
    tok('fg/informative/base',  'Informative text on default background'),
    tok('fg/informative/alt',   'Informative text on surface/informative/subtle'),
    tok('fg/discovery/base',    'Discovery text on default background'),
    tok('fg/discovery/alt',     'Discovery text on surface/discovery/subtle'),
  ]),

  group('border', 'Border', 'Border, outline, and divider colors', [
    tok('border/default',     'Default border and dividers'),
    tok('border/strong',      'Emphasized borders and focus outlines'),
    tok('border/subtle',      'Very subtle separators'),
    tok('border/brand',       'Brand accent border'),
    tok('border/danger',      'Error / danger state border'),
    tok('border/success',     'Success state border'),
    tok('border/warning',     'Warning state border'),
    tok('border/informative', 'Informative state border'),
    tok('border/discovery',   'Discovery accent border'),
    tok('border/disabled',    'Disabled state border'),
  ]),

  group('focus', 'Focus', 'Focus ring colors for keyboard navigation', [
    tok('focus/ring',         'Focus ring — light and dark variants'),
  ]),
]
