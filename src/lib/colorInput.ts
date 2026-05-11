import { hexToOklch, oklchToHex, clampToGamut } from './color'

export type ParseResult =
  | { ok: true; hex: string }
  | { ok: false; error: string }

function clamp01(v: number) { return Math.max(0, Math.min(1, v)) }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

function rgbToHex(r: number, g: number, b: number): string {
  const R = Math.round(clamp(r, 0, 255))
  const G = Math.round(clamp(g, 0, 255))
  const B = Math.round(clamp(b, 0, 255))
  return `#${R.toString(16).padStart(2, '0')}${G.toString(16).padStart(2, '0')}${B.toString(16).padStart(2, '0')}`
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const S = s / 100
  const L = l / 100
  const a = S * Math.min(L, 1 - L)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return L - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
  }
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function parseHex(raw: string): ParseResult {
  let s = raw.replace(/^#/, '').trim()
  if (s.length === 3) s = s.split('').map(c => c + c).join('')
  if (s.length === 8) s = s.slice(0, 6) // strip alpha silently
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return { ok: false, error: 'Invalid hex value' }
  return { ok: true, hex: '#' + s.toLowerCase() }
}

function parseOklch(raw: string): ParseResult {
  // oklch(L C H) or oklch(L, C, H) — L in 0–1, C ≥ 0, H in 0–360
  const m = raw.match(/oklch\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*\)/i)
  if (!m) return { ok: false, error: 'Expected oklch(L C H)' }
  const l = clamp01(parseFloat(m[1]!))
  const c = Math.max(0, parseFloat(m[2]!))
  const h = clamp(parseFloat(m[3]!), 0, 360)
  if ([l, c, h].some(isNaN)) return { ok: false, error: 'Invalid OKLCH values' }
  const [cl, cc, ch] = clampToGamut(l, c, h)
  return { ok: true, hex: oklchToHex(cl, cc, ch) }
}

function parseHsl(raw: string): ParseResult {
  // hsl(H, S%, L%) or H S% L%
  const withFn = raw.match(/hsl\(\s*([\d.]+)[,\s]+([\d.]+)%?[,\s]+([\d.]+)%?\s*\)/i)
  const bare   = !withFn ? raw.match(/^([\d.]+)\s+([\d.]+)%?\s+([\d.]+)%?$/) : null
  const m = withFn ?? bare
  if (!m) return { ok: false, error: 'Expected hsl(H, S%, L%)' }
  const h = clamp(parseFloat(m[1]!), 0, 360)
  const s = clamp(parseFloat(m[2]!), 0, 100)
  const l = clamp(parseFloat(m[3]!), 0, 100)
  if ([h, s, l].some(isNaN)) return { ok: false, error: 'Invalid HSL values' }
  const [r, g, b] = hslToRgb(h, s, l)
  return { ok: true, hex: rgbToHex(r, g, b) }
}

function parseRgb(raw: string): ParseResult {
  // rgb(R, G, B) or R, G, B or R G B
  const withFn = raw.match(/rgb\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)\s*\)/i)
  const bare   = !withFn ? raw.match(/^([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)$/) : null
  const m = withFn ?? bare
  if (!m) return { ok: false, error: 'Expected rgb(R, G, B)' }
  const r = parseFloat(m[1]!)
  const g = parseFloat(m[2]!)
  const b = parseFloat(m[3]!)
  if ([r, g, b].some(isNaN)) return { ok: false, error: 'Invalid RGB values' }
  return { ok: true, hex: rgbToHex(r, g, b) }
}

export function parseColorInput(raw: string): ParseResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, error: 'Empty input' }

  if (trimmed.toLowerCase().startsWith('oklch')) return parseOklch(trimmed)
  if (trimmed.toLowerCase().startsWith('hsl')) return parseHsl(trimmed)
  if (trimmed.toLowerCase().startsWith('rgb')) return parseRgb(trimmed)

  // Bare numbers: try OKLCH first (3 space/comma separated, first ≤ 1) then RGB
  const parts = trimmed.split(/[\s,]+/)
  if (parts.length === 3) {
    const [a, b, c] = parts.map(Number)
    if (!isNaN(a!) && !isNaN(b!) && !isNaN(c!)) {
      if (a! <= 1 && b! <= 1) return parseOklch(`oklch(${a} ${b} ${c})`)
      return parseRgb(`rgb(${a}, ${b}, ${c})`)
    }
  }

  // Fallback: hex
  return parseHex(trimmed)
}

export function hexToDisplayValues(hex: string) {
  const [l, c, h] = hexToOklch(hex)
  return { l, c, h }
}
