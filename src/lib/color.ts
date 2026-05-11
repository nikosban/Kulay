// OKLab/OKLCh conversion using Björn Ottosson's matrices

function linearize(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function delinearize(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

export function hexToOklch(hex: string): [number, number, number] {
  const r = linearize(parseInt(hex.slice(1, 3), 16) / 255)
  const g = linearize(parseInt(hex.slice(3, 5), 16) / 255)
  const b = linearize(parseInt(hex.slice(5, 7), 16) / 255)

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s
  const bv = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s

  const C = Math.sqrt(a * a + bv * bv)
  let H = Math.atan2(bv, a) * (180 / Math.PI)
  if (H < 0) H += 360

  return [L, C, H]
}

function oklchToLinearRgb(L: number, C: number, H: number): [number, number, number] {
  const hr = H * (Math.PI / 180)
  const a = C * Math.cos(hr)
  const b = C * Math.sin(hr)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b

  const l = l_ * l_ * l_
  const m = m_ * m_ * m_
  const s = s_ * s_ * s_

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}

function isInGamut(L: number, C: number, H: number): boolean {
  const [r, g, b] = oklchToLinearRgb(L, C, H)
  const eps = 1e-4
  return r >= -eps && r <= 1 + eps && g >= -eps && g <= 1 + eps && b >= -eps && b <= 1 + eps
}

export function clampToGamut(L: number, C: number, H: number): [number, number, number] {
  if (isInGamut(L, C, H)) return [L, C, H]
  let lo = 0
  let hi = C
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (isInGamut(L, mid, H)) lo = mid
    else hi = mid
  }
  return [L, lo, H]
}

export function oklchToHex(L: number, C: number, H: number): string {
  const [r, g, b] = oklchToLinearRgb(L, C, H)
  const R = Math.round(Math.max(0, Math.min(1, delinearize(r))) * 255)
  const G = Math.round(Math.max(0, Math.min(1, delinearize(g))) * 255)
  const B = Math.round(Math.max(0, Math.min(1, delinearize(b))) * 255)
  return `#${R.toString(16).padStart(2, '0')}${G.toString(16).padStart(2, '0')}${B.toString(16).padStart(2, '0')}`
}
