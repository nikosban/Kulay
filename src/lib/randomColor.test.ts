import { describe, expect, it } from 'vitest'
import { hexToOklch } from './color'
import { generateDiverseColor } from './randomColor'

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 0x100000000
  }
}

function hueDistance(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360
  return Math.min(delta, 360 - delta)
}

describe('diverse random color generation', () => {
  it('fills perceptual hue gaps instead of repeating occupied families', () => {
    const random = seededRandom(42)
    const colors: string[] = []
    for (let i = 0; i < 8; i++) {
      const color = generateDiverseColor({
        existingHexes: colors,
        stepCount: 10,
        lightnessRange: { lightest: 0.96, darkest: 0.12 },
        random,
      })
      expect(color).not.toBeNull()
      colors.push(color!)
    }

    const hues = colors.map((color) => hexToOklch(color)[2])
    for (let i = 1; i < hues.length; i++) {
      const nearestEarlierHue = Math.min(...hues.slice(0, i).map((hue) => hueDistance(hues[i]!, hue)))
      expect(nearestEarlierHue).toBeGreaterThanOrEqual(24)
    }
  })

  it('keeps semantic-role candidates inside the requested hue neighborhood', () => {
    const color = generateDiverseColor({
      existingHexes: ['#3b82f6', '#ef4444'],
      stepCount: 10,
      lightnessRange: { lightest: 0.96, darkest: 0.12 },
      targetHue: 145,
      hueRadius: 12,
      random: seededRandom(7),
    })
    expect(color).not.toBeNull()
    expect(hueDistance(hexToOklch(color!)[2], 145)).toBeLessThanOrEqual(13)
  })
})
