function hueChromaMultiplier(H: number, stepFraction: number): number {
  // stepFraction: 0 = lightest, 1 = darkest (lightness axis, not step index)
  const lightness = 1 - stepFraction

  if ((H >= 0 && H <= 15) || (H >= 345 && H <= 360)) {
    return 1 - 0.3 * Math.pow(lightness, 2)
  }
  if (H >= 16 && H <= 65) {
    return 1 - 0.1 * Math.pow(lightness, 3) - 0.1 * Math.pow(stepFraction, 3)
  }
  if (H >= 66 && H <= 85) {
    return 1 - 0.6 * Math.pow(lightness, 1.5)
  }
  if (H >= 86 && H <= 150) {
    return 1 - 0.35 * Math.pow(lightness, 1.2)
  }
  if (H >= 151 && H <= 230) {
    return 1 - 0.15 * Math.pow(lightness, 3) - 0.1 * Math.pow(stepFraction, 3)
  }
  if (H >= 231 && H <= 290) {
    return 1 - 0.05 * Math.pow(lightness, 2)
  }
  if (H >= 291 && H <= 320) {
    return 1 - 0.2 * Math.pow(lightness, 2)
  }
  if (H >= 321 && H <= 344) {
    return 1 - 0.25 * Math.pow(lightness, 2)
  }
  return 1
}

function hueShift(H: number, stepFraction: number): number {
  const lightness = 1 - stepFraction
  // Reds: lighter steps drift toward orange — pull back toward red/magenta
  if ((H >= 0 && H <= 25) || (H >= 345 && H <= 360)) {
    return -3 * Math.pow(lightness, 2)
  }
  // Blues: lighter steps drift toward cyan — pull back toward blue/indigo
  if (H >= 210 && H <= 260) {
    return 4 * Math.pow(lightness, 2)
  }
  // Purples: lighter steps drift toward blue — push toward red/pink
  if (H >= 291 && H <= 320) {
    return 5 * Math.pow(lightness, 2)
  }
  return 0
}

// Per-hue chroma boost for dark mode: warm hues need more saturation on dark
// backgrounds; blues/cyans already read strongly so they get a lighter touch.
function darkChromaBoost(H: number): number {
  // Reds
  if ((H >= 0 && H <= 25) || (H >= 345 && H <= 360)) return 1.40
  // Warm oranges / yellows
  if (H >= 26 && H <= 90) return 1.35
  // Yellow-greens / greens
  if (H >= 91 && H <= 180) return 1.20
  // Cyans / blue-greens
  if (H >= 181 && H <= 230) return 1.05
  // Blues / indigos
  if (H >= 231 && H <= 270) return 1.08
  // Purples / violets
  if (H >= 271 && H <= 320) return 1.18
  // Magentas / pinks
  if (H >= 321 && H <= 344) return 1.28
  return 1.25
}

// Chroma envelope anchored at base step, tapering toward extremes.
// FLOOR of 0.07 lets extreme steps fade toward near-gray for a natural tint feel.
function envelope(t: number, tBase: number, exponent = 0.75): number {
  const FLOOR = 0.07
  if (tBase <= 0) return t <= 0 ? 1 : Math.max(FLOOR, Math.pow(1 - t, exponent))
  if (tBase >= 1) return t >= 1 ? 1 : Math.max(FLOOR, Math.pow(t, exponent))
  return t <= tBase
    ? Math.max(FLOOR, Math.pow(t / tBase, exponent))
    : Math.max(FLOOR, Math.pow((1 - t) / (1 - tBase), exponent))
}

export interface HarmonizedStep {
  L: number
  C: number
  H: number
}

export function harmonize(
  inputL: number,
  inputC: number,
  inputH: number,
  stepCount: number,
  mode: 'light' | 'dark' = 'light',
  lRange: { lightest: number; darkest: number } = { lightest: 0.96, darkest: 0.12 },
): HarmonizedStep[] {
  // Light: step 0 = lightest, step n-1 = darkest
  // Dark:  step 0 = darkest,  step n-1 = lightest (fixed at 0.85 for dark-bg legibility)
  const L_START = mode === 'dark' ? lRange.darkest : lRange.lightest
  const L_END   = mode === 'dark' ? 0.85            : lRange.darkest
  // Boost chroma for dark backgrounds — per-hue so warm colors get more, blues/cyans less
  const chromaBoost = mode === 'dark' ? darkChromaBoost(inputH) : 1.0
  const n = stepCount

  const lightnesses = Array.from({ length: n }, (_, i) => L_START + (i / (n - 1)) * (L_END - L_START))

  let baseIndex = 0
  let minDiff = Infinity
  for (let i = 0; i < n; i++) {
    const diff = Math.abs(lightnesses[i]! - inputL)
    if (diff < minDiff || (diff === minDiff && i < baseIndex)) {
      minDiff = diff
      baseIndex = i
    }
  }
  const tBase = baseIndex / (n - 1)

  const isNeutral = inputC < 0.04

  const steps: HarmonizedStep[] = lightnesses.map((L, i) => {
    const t = i / (n - 1)

    if (isNeutral) {
      return { L, C: inputC, H: inputH }
    }

    // stepFraction for hue multiplier: 0 = lightest, 1 = darkest (independent of mode)
    const stepFraction = mode === 'dark' ? 1 - t : t

    const raw = envelope(t, tBase) * hueChromaMultiplier(inputH, stepFraction)
    const envelopeAtBase = envelope(tBase, tBase) * hueChromaMultiplier(inputH, mode === 'dark' ? 1 - tBase : tBase)
    const scale = envelopeAtBase > 0 ? (inputC * chromaBoost) / envelopeAtBase : 0
    const C = Math.max(0, raw * scale)
    const H = inputH + hueShift(inputH, stepFraction)

    return { L, C, H }
  })

  return steps
}
