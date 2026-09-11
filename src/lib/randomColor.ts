import type { LightnessRange } from '../types/project'
import { hexToOklch, maxChromaInGamut, oklchToHex } from './color'
import { validateBasePosition, type GenOpts } from './generatePalette'

interface DiverseColorOptions {
  existingHexes: string[]
  stepCount: number
  lightnessRange: LightnessRange
  genOpts?: GenOpts
  mode?: 'light' | 'dark'
  targetHue?: number
  hueRadius?: number
  random?: () => number
  candidateCount?: number
}

function circularHueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360
  return Math.min(delta, 360 - delta)
}

function oklabPoint(hex: string): [number, number, number] {
  const [l, c, h] = hexToOklch(hex)
  const radians = h * Math.PI / 180
  return [l, c * Math.cos(radians), c * Math.sin(radians)]
}

function distance(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/**
 * Generates a random-looking color while preferring the largest perceptual gap
 * in the current palette set. Chroma is sampled as gamut occupancy, so narrow-
 * gamut hues are not unfairly desaturated by a fixed absolute chroma request.
 */
export function generateDiverseColor(options: DiverseColorOptions): string | null {
  const random = options.random ?? Math.random
  const count = options.candidateCount ?? 96
  const mode = options.mode ?? 'light'
  const opts = options.genOpts ?? {}
  const existing = options.existingHexes.map((hex) => ({
    point: oklabPoint(hex),
    oklch: hexToOklch(hex),
  }))
  const hueOffset = random() * 360
  const goldenAngle = 137.50776405003785

  let best: { hex: string; score: number } | null = null
  for (let i = 0; i < count; i++) {
    const spreadHue = (hueOffset + i * goldenAngle) % 360
    const hueJitter = (random() - 0.5) * 4
    const hue = options.targetHue === undefined
      ? (spreadHue + hueJitter + 360) % 360
      : (options.targetHue + (random() * 2 - 1) * (options.hueRadius ?? 12) + 360) % 360
    const lightness = 0.46 + random() * 0.18
    const saturation = 0.66 + random() * 0.24
    const chroma = Math.min(0.28, maxChromaInGamut(lightness, hue) * saturation)
    const hex = oklchToHex(lightness, chroma, hue)

    if (validateBasePosition(hex, options.stepCount, options.lightnessRange, opts, mode) !== null) continue
    if (existing.length === 0) return hex

    const point = oklabPoint(hex)
    const [, candidateC, candidateH] = hexToOklch(hex)
    const minDistance = Math.min(...existing.map((color) => distance(point, color.point)))
    const chromaticExisting = existing.filter((color) => color.oklch[1] >= 0.045 && candidateC >= 0.045)
    const minHueDistance = chromaticExisting.length > 0
      ? Math.min(...chromaticExisting.map((color) => circularHueDistance(candidateH, color.oklch[2])))
      : 180
    const hueScore = options.targetHue === undefined ? (minHueDistance / 180) * 0.12 : 0
    const duplicatePenalty = options.targetHue === undefined && minHueDistance < 24 ? 0.5 : 0
    const score = minDistance + hueScore - duplicatePenalty

    if (!best || score > best.score) best = { hex, score }
  }

  return best?.hex ?? null
}
