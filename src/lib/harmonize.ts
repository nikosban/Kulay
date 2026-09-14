import { clampToGamut, maxChromaInGamut } from './color'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(min: number, max: number, value: number): number {
  const t = clamp01((value - min) / (max - min))
  return t * t * (3 - 2 * t)
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

// Preserve light-end identity in two continuous ways:
// - chromatic colors retain a share of the gamut they occupied at the base;
// - tinted neutrals retain an absolute tint signal instead of fading to gray.
// The blend avoids a hard neutral/chromatic mode boundary.
function lightEndChromaFloor(
  inputL: number,
  inputC: number,
  inputH: number,
  stepL: number,
  stepH: number,
  progress: number,
  lightFalloff: number,
): number {
  if (inputC < 0.008 || progress <= 0) return 0

  const neutralWeight = 1 - smoothstep(0.018, 0.07, inputC)
  const baseCapacity = Math.max(0.0001, maxChromaInGamut(inputL, inputH))
  const baseOccupancy = clamp01(inputC / baseCapacity)
  const stepCapacity = maxChromaInGamut(stepL, stepH)
  const tintRetention = Math.max(0.32, Math.min(0.76, 0.85 - 0.35 * lightFalloff))
  const colorRetention = Math.max(0.48, Math.min(0.88, 0.98 - 0.30 * lightFalloff))

  const tintFloor = inputC * mix(1, tintRetention, progress)
  const chromaticFloor = stepCapacity * baseOccupancy * mix(1, colorRetention, progress)
  return mix(chromaticFloor, tintFloor, neutralWeight)
}

// Greens have an unusually wide sRGB cusp at high lightness. Preserving the
// same gamut occupancy there reads as fluorescent rather than merely colorful.
// This smooth ceiling is strongest for lime/green, fades through neighboring
// hues, and does not engage for tinted neutrals.
function lightGreenChromaCeiling(
  inputC: number,
  stepL: number,
  stepH: number,
): number {
  const hue = ((stepH % 360) + 360) % 360
  const enterGreen = smoothstep(72, 98, hue)
  const leaveGreen = 1 - smoothstep(150, 178, hue)
  const greenWeight = enterGreen * leaveGreen
  const lightRisk = smoothstep(0.78, 0.95, stepL)
  const lightActivation = smoothstep(0.72, 0.84, stepL)
  const chromaticWeight = smoothstep(0.035, 0.09, inputC)
  const correction = greenWeight * lightActivation * chromaticWeight
  const maxOccupancyAtThisLightness = mix(0.58, 0.20, lightRisk)
  const capacity = maxChromaInGamut(stepL, stepH)
  return capacity * mix(1, maxOccupancyAtThisLightness, correction)
}

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
  const darkness = stepFraction

  // Reds: lighter steps drift toward orange (pull back), darker steps drift toward maroon (pull back)
  if ((H >= 0 && H <= 25) || (H >= 345 && H <= 360)) {
    return -3 * Math.pow(lightness, 2) + 2 * Math.pow(darkness, 2)
  }
  // Blues: lighter steps drift toward cyan (pull back), darker steps drift toward indigo (pull toward blue)
  if (H >= 210 && H <= 260) {
    return 4 * Math.pow(lightness, 2) + 3 * Math.pow(darkness, 2)
  }
  // Purples: lighter steps drift toward blue — push toward red/pink
  if (H >= 291 && H <= 320) {
    return 5 * Math.pow(lightness, 2)
  }
  // Greens: darker steps drift toward teal — pull back toward green
  if (H >= 86 && H <= 150) {
    return -2 * Math.pow(darkness, 2)
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

// Find the highest L where this hue can sustain ~0.18 chroma, clamped to [0.82, 0.92].
// Hues with wide gamut at high L (amber) return ~0.92; narrow-gamut hues (indigo) return lower.
export function maxDarkL(H: number): number {
  for (let L = 0.92; L >= 0.82; L -= 0.01) {
    const [, cC] = clampToGamut(L, 0.18, H)
    if (cC >= 0.18 * 0.95) return L
  }
  return 0.82
}

// Chroma envelope anchored at base step, tapering toward extremes.
// FLOOR of 0.07 lets extreme steps fade toward near-gray for a natural tint feel.
function envelope(
  t: number,
  tBase: number,
  beforeExponent = 0.75,
  afterExponent = beforeExponent,
): number {
  const FLOOR = 0.07
  if (tBase <= 0) return t <= 0 ? 1 : Math.max(FLOOR, Math.pow(1 - t, afterExponent))
  if (tBase >= 1) return t >= 1 ? 1 : Math.max(FLOOR, Math.pow(t, beforeExponent))
  return t <= tBase
    ? Math.max(FLOOR, Math.pow(t / tBase, beforeExponent))
    : Math.max(FLOOR, Math.pow((1 - t) / (1 - tBase), afterExponent))
}

export interface HarmonizedStep {
  L: number
  C: number
  H: number
}

export interface HarmonizeOpts {
  envelopeExponent?: number
  lightChromaFalloff?: number
  darkChromaFalloff?: number
  lightHueShift?: number
  darkHueShift?: number
  lightnessDistribution?: 'linear' | 'perceptual'
}

export function computeLightnesses(
  stepCount: number,
  mode: 'light' | 'dark',
  lRange: { lightest: number; darkest: number },
  hue: number,
  distribution: 'linear' | 'perceptual' = 'linear',
): number[] {
  const start = mode === 'dark' ? lRange.darkest : lRange.lightest
  const end = mode === 'dark' ? maxDarkL(hue) : lRange.darkest
  return Array.from({ length: stepCount }, (_, i) => {
    const raw = i / (stepCount - 1)
    const t = distribution === 'perceptual'
      ? (raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2)
      : raw
    return start + t * (end - start)
  })
}

export function harmonize(
  inputL: number,
  inputC: number,
  inputH: number,
  stepCount: number,
  mode: 'light' | 'dark' = 'light',
  lRange: { lightest: number; darkest: number } = { lightest: 0.96, darkest: 0.12 },
  opts: HarmonizeOpts = {},
): HarmonizedStep[] {
  const exponent = opts.envelopeExponent ?? 0.75
  const lightFalloff = opts.lightChromaFalloff ?? exponent
  const darkFalloff = opts.darkChromaFalloff ?? exponent
  const beforeFalloff = mode === 'dark' ? darkFalloff : lightFalloff
  const afterFalloff = mode === 'dark' ? lightFalloff : darkFalloff

  // Light: step 0 = lightest, step n-1 = darkest
  // Dark:  step 0 = darkest,  step n-1 = lightest (ceiling adaptive per hue for gamut fit)
  // Boost chroma for dark backgrounds — per-hue so warm colors get more, blues/cyans less
  const chromaBoost = mode === 'dark' ? darkChromaBoost(inputH) : 1.0
  const n = stepCount

  const lightnesses = computeLightnesses(
    n,
    mode,
    lRange,
    inputH,
    opts.lightnessDistribution ?? 'linear',
  )

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

  const steps: HarmonizedStep[] = lightnesses.map((L, i) => {
    const t = i / (n - 1)

    // stepFraction for hue multiplier: 0 = lightest, 1 = darkest (independent of mode)
    const stepFraction = mode === 'dark' ? 1 - t : t

    // Near-neutrals retain their actual tint instead of crossing a threshold
    // into a separate hard-coded color model.
    const multiplier = inputC < 0.04 ? 1 : hueChromaMultiplier(inputH, stepFraction)
    const baseMultiplier = inputC < 0.04
      ? 1
      : hueChromaMultiplier(inputH, mode === 'dark' ? 1 - tBase : tBase)
    const raw = envelope(t, tBase, beforeFalloff, afterFalloff) * multiplier
    const envelopeAtBase = envelope(tBase, tBase, beforeFalloff, afterFalloff) * baseMultiplier
    const scale = envelopeAtBase > 0 ? (inputC * chromaBoost) / envelopeAtBase : 0
    const C = Math.max(0, raw * scale)
    const baseFraction = mode === 'dark' ? 1 - tBase : tBase
    const customHueShift = stepFraction <= baseFraction
      ? (opts.lightHueShift ?? 0) * (baseFraction <= 0 ? 0 : (baseFraction - stepFraction) / baseFraction)
      : (opts.darkHueShift ?? 0) * (baseFraction >= 1 ? 0 : (stepFraction - baseFraction) / (1 - baseFraction))
    const automaticHueShift = inputC < 0.04 ? 0 : hueShift(inputH, stepFraction)
    const H = inputH + automaticHueShift + customHueShift

    // Use exact input L at the base step. At the very light end, move inward by
    // at most 0.04 only when a tinted neutral's identity cannot fit in sRGB.
    const lightProgress = stepFraction < baseFraction && baseFraction > 0
      ? (baseFraction - stepFraction) / baseFraction
      : 0
    let stepL = i === baseIndex ? inputL : L
    if (lightProgress > 0.8 && inputC >= 0.008) {
      const neutralWeight = 1 - smoothstep(0.018, 0.07, inputC)
      const retention = Math.max(0.32, Math.min(0.76, 0.85 - 0.35 * lightFalloff))
      const requiredTint = inputC * mix(1, retention, lightProgress) * neutralWeight
      const maxShift = 0.04 * smoothstep(0.8, 1, lightProgress)
      for (let shift = 0; shift <= maxShift + 1e-9; shift += 0.001) {
        const candidateL = Math.max(inputL, L - shift)
        stepL = candidateL
        if (maxChromaInGamut(candidateL, H) >= requiredTint) break
      }
    }

    const identityFloor = lightEndChromaFloor(
      inputL,
      inputC,
      inputH,
      stepL,
      H,
      lightProgress,
      lightFalloff,
    )
    const retainedC = Math.min(
      Math.max(C, identityFloor),
      lightGreenChromaCeiling(inputC, stepL, H),
    )

    return { L: stepL, C: retainedC, H }
  })

  return steps
}
