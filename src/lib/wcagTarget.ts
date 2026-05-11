import { hexToOklch, clampToGamut, oklchToHex } from './color'
import { contrastRatio } from './wcag'

const ITERATIONS = 40

export function adjustStepForWcagTarget(
  hex: string,
  targetRatio: number,
  backgroundHex: string,
): string {
  const [, c, hue] = hexToOklch(hex)
  const bgLum = relativeLuminance(backgroundHex)

  // Try lightening (high L) and darkening (low L) to find which side achieves target
  function contrastAt(l: number): number {
    const [cl, cc, ch] = clampToGamut(l, c, hue)
    const candidate = oklchToHex(cl, cc, ch)
    return contrastRatio(candidate, backgroundHex)
  }

  function binarySearch(lo: number, hi: number): string {
    let low = lo
    let high = hi
    for (let i = 0; i < ITERATIONS; i++) {
      const mid = (low + high) / 2
      const ratio = contrastAt(mid)
      if (ratio < targetRatio) {
        // Need more contrast — move away from bg luminance
        if (bgLum > 0.5) high = mid  // bg is light, step needs to go darker
        else low = mid                 // bg is dark, step needs to go lighter
      } else {
        if (bgLum > 0.5) low = mid
        else high = mid
      }
    }
    const [cl, cc, ch] = clampToGamut((low + high) / 2, c, hue)
    return oklchToHex(cl, cc, ch)
  }

  // Check if target is achievable at all — try both extremes
  const darkContrast = contrastAt(0.02)
  const lightContrast = contrastAt(0.98)

  if (bgLum > 0.5) {
    // Light background: darker step gives more contrast
    if (darkContrast < targetRatio) return oklchToHex(...clampToGamut(0.02, c, hue))
    return binarySearch(0.02, 0.98)
  } else {
    // Dark background: lighter step gives more contrast
    if (lightContrast < targetRatio) return oklchToHex(...clampToGamut(0.98, c, hue))
    return binarySearch(0.02, 0.98)
  }
}

function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
