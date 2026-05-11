export type HexValidationError =
  | 'invalid-chars'
  | 'white-blocked'
  | 'black-blocked'
  | 'too-light'
  | 'too-dark'

export interface SanitizeResult {
  hex: string
  alphaStripped: boolean
}

export function sanitizeHex(raw: string): SanitizeResult | null {
  let value = raw.trim().replace(/^#/, '')

  // Must be hex characters only
  if (!/^[0-9a-fA-F]+$/.test(value)) return null

  let alphaStripped = false

  if (value.length === 3) {
    value = value.split('').map((c) => c + c).join('')
  } else if (value.length === 8) {
    value = value.slice(0, 6)
    alphaStripped = true
  } else if (value.length !== 6) {
    return null
  }

  return { hex: `#${value.toLowerCase()}`, alphaStripped }
}

export function validateHex(hex: string): HexValidationError | null {
  if (hex === '#ffffff') return 'white-blocked'
  if (hex === '#000000') return 'black-blocked'
  return null
}
