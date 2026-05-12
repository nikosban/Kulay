import { useState, useEffect, useCallback, useRef } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import type { Palette } from '../../types/project'
import { DEFAULT_LIGHTNESS_RANGE, DEFAULT_LABEL_SCALE } from '../../types/project'
import { generatePalette, relabelPalette } from '../../lib/generatePalette'
import { parseColorInput } from '../../lib/colorInput'
import { hexToOklch, clampToGamut, oklchToHex } from '../../lib/color'
import { IconX, IconPlus, IconTrash, IconArrowLeft, IconCheck } from '@tabler/icons-react'

// ── Constants ─────────────────────────────────────────────────────────────────

type ModalStep = 'choose' | 'branded-colors' | 'branded-harmonies'

const DEFAULT_BG = { light: '#ffffff', dark: '#000000' }
const STEP_COUNT = 10

interface HarmonyDef {
  id: string
  label: string
  description: string
  hueShifts: number[]
}

const HARMONY_DEFS: HarmonyDef[] = [
  {
    id: 'complementary',
    label: 'Complementary',
    description: 'Opposite on the wheel — high contrast',
    hueShifts: [180],
  },
  {
    id: 'triadic',
    label: 'Triadic',
    description: 'Three evenly spaced hues — vibrant balance',
    hueShifts: [120, 240],
  },
  {
    id: 'analogous',
    label: 'Analogous',
    description: 'Adjacent hues — harmonious and calm',
    hueShifts: [30, -30],
  },
  {
    id: 'split',
    label: 'Split-complementary',
    description: 'Two near-complements — softer contrast',
    hueShifts: [150, 210],
  },
]

// Starter palette seeds (OKLCH)
const STARTER_SEEDS: Array<{ l: number; c: number; h: number }> = [
  { l: 0.55, c: 0.014, h: 55 },  // Stone
  { l: 0.55, c: 0.22,  h: 27 },  // Red
  { l: 0.55, c: 0.22,  h: 262 }, // Blue
  { l: 0.55, c: 0.18,  h: 142 }, // Green
  { l: 0.55, c: 0.14,  h: 66 },  // Gold
  { l: 0.55, c: 0.18,  h: 303 }, // Purple
]

// Pre-compute starter hex values at module load (pure functions, no side effects)
const STARTER_HEXES: string[] = STARTER_SEEDS.map((s) => {
  const [cl, cc, ch] = clampToGamut(s.l, s.c, s.h)
  return oklchToHex(cl, cc, ch)
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePalette(hex: string, existingPalettes: Palette[]): Palette {
  const p = generatePalette(hex, STEP_COUNT, DEFAULT_BG, existingPalettes, DEFAULT_LIGHTNESS_RANGE)
  return relabelPalette(p, DEFAULT_LIGHTNESS_RANGE, DEFAULT_LABEL_SCALE)
}

function shiftHue(hex: string, shiftDeg: number): string {
  const [l, c, h] = hexToOklch(hex)
  const newH = ((h + shiftDeg) % 360 + 360) % 360
  const [cl, cc, ch] = clampToGamut(l, c, newH)
  return oklchToHex(cl, cc, ch)
}

// ── Color input row ───────────────────────────────────────────────────────────

interface ColorRow {
  id: string
  value: string
  hex: string | null
  error: string | null
}

function makeRow(): ColorRow {
  return { id: crypto.randomUUID(), value: '', hex: null, error: null }
}

function parseRow(row: ColorRow, value: string): ColorRow {
  if (!value.trim()) return { ...row, value, hex: null, error: null }
  const result = parseColorInput(value)
  return result.ok
    ? { ...row, value, hex: result.hex, error: null }
    : { ...row, value, hex: null, error: result.error }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
  onCreate: (palettes: Palette[]) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NewProjectModal({ onClose, onCreate }: Props) {
  const [step, setStep] = useState<ModalStep>('choose')
  const [colorRows, setColorRows] = useState<ColorRow[]>([makeRow()])
  const [selectedHarmonies, setSelectedHarmonies] = useState<Set<string>>(new Set())
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  const brandHexes = colorRows.map((r) => r.hex).filter(Boolean) as string[]
  const primaryHex = brandHexes[0] ?? null

  // Escape key to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleChooseEmpty = useCallback(() => {
    onCreate([])
  }, [onCreate])

  const handleChooseStarter = useCallback(() => {
    const palettes: Palette[] = []
    for (const hex of STARTER_HEXES) {
      palettes.push(makePalette(hex, palettes))
    }
    onCreate(palettes)
  }, [onCreate])

  function updateRow(id: string, value: string) {
    setColorRows((rows) => rows.map((r) => (r.id === id ? parseRow(r, value) : r)))
  }

  function updateRowFromPicker(id: string, hex: string) {
    setColorRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, value: hex, hex, error: null } : r)),
    )
  }

  function addRow() {
    if (colorRows.length < 3) setColorRows((rows) => [...rows, makeRow()])
  }

  function removeRow(id: string) {
    setColorRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows))
  }

  function handleBrandedNext() {
    if (brandHexes.length === 0) return
    setSelectedHarmonies(new Set()) // reset on each visit
    setStep('branded-harmonies')
  }

  function handleCreateBranded() {
    const palettes: Palette[] = []
    // Brand colors first
    for (const hex of brandHexes) {
      palettes.push(makePalette(hex, palettes))
    }
    // Harmony palettes derived from the primary brand color
    if (primaryHex) {
      for (const def of HARMONY_DEFS) {
        if (!selectedHarmonies.has(def.id)) continue
        for (const shift of def.hueShifts) {
          palettes.push(makePalette(shiftHue(primaryHex, shift), palettes))
        }
      }
    }
    onCreate(palettes)
  }

  function toggleHarmony(id: string) {
    setSelectedHarmonies((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function goBack() {
    if (step === 'branded-harmonies') setStep('branded-colors')
    else if (step === 'branded-colors') setStep('choose')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const headerTitle =
    step === 'choose' ? 'New Project' :
    step === 'branded-colors' ? 'Brand Colors' :
    'Add Harmonies'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-project-title"
        className="bg-surface-base dark:bg-surface-base-dark rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bd-base dark:border-bd-base-dark">
          <div className="flex items-center gap-2">
            {step !== 'choose' && (
              <button
                onClick={goBack}
                className="text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-base dark:hover:text-fg-base-dark transition-colors"
                aria-label="Back"
              >
                <IconArrowLeft size={17} />
              </button>
            )}
            <h2 id="new-project-title" className="text-sm font-semibold text-fg-base dark:text-fg-base-dark">{headerTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-base dark:hover:text-fg-base-dark transition-colors"
            aria-label="Close"
          >
            <IconX size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">

          {/* ── Choose ──────────────────────────────────────────────────────── */}
          {step === 'choose' && (
            <div className="flex flex-col gap-2.5">
              {/* Empty */}
              <button
                onClick={handleChooseEmpty}
                className="w-full text-left rounded-xl border border-bd-base dark:border-bd-base-dark px-4 py-3.5 hover:border-bd-strong dark:hover:border-bd-strong-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
              >
                <div className="text-sm font-medium text-fg-base dark:text-fg-base-dark mb-0.5">Empty</div>
                <div className="text-xs text-fg-muted dark:text-fg-muted-dark">Start with a blank canvas. Add palettes manually.</div>
              </button>

              {/* Branded */}
              <button
                onClick={() => setStep('branded-colors')}
                className="w-full text-left rounded-xl border border-bd-base dark:border-bd-base-dark px-4 py-3.5 hover:border-bd-strong dark:hover:border-bd-strong-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
              >
                <div className="text-sm font-medium text-fg-base dark:text-fg-base-dark mb-0.5">Branded</div>
                <div className="text-xs text-fg-muted dark:text-fg-muted-dark">Enter your brand colors. We'll suggest harmonious companions.</div>
              </button>

              {/* Starter */}
              <button
                onClick={handleChooseStarter}
                className="w-full text-left rounded-xl border border-bd-base dark:border-bd-base-dark px-4 py-3.5 hover:border-bd-strong dark:hover:border-bd-strong-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
              >
                <div className="text-sm font-medium text-fg-base dark:text-fg-base-dark mb-0.5">Starter palette</div>
                <div className="text-xs text-fg-muted dark:text-fg-muted-dark mb-3">A ready-made set: neutral, red, blue, green, gold, and purple.</div>
                <div className="flex gap-1.5">
                  {STARTER_HEXES.map((hex, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/10"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </button>
            </div>
          )}

          {/* ── Branded: Color inputs ──────────────────────────────────────── */}
          {step === 'branded-colors' && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-fg-muted dark:text-fg-muted-dark">
                Enter up to 3 core brand colors. Hex, oklch, hsl, or rgb all work.
              </p>

              <div className="flex flex-col gap-2">
                {colorRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    {/* Color swatch + native picker */}
                    <label className="relative w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden border border-bd-base dark:border-bd-base-dark cursor-pointer">
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: row.hex ?? '#e5e5e5' }}
                      />
                      <input
                        type="color"
                        value={row.hex ?? '#000000'}
                        onChange={(e) => updateRowFromPicker(row.id, e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        tabIndex={-1}
                      />
                    </label>

                    {/* Text input */}
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => updateRow(row.id, e.target.value)}
                      placeholder="#3b82f6"
                      spellCheck={false}
                      className={[
                        'flex-1 px-3 py-1.5 rounded-lg border text-sm',
                        'bg-surface-control dark:bg-surface-control-dark text-fg-base dark:text-fg-base-dark',
                        'placeholder-fg-placeholder dark:placeholder-fg-placeholder-dark',
                        'outline-none focus:ring-2 transition-colors',
                        row.error
                          ? 'border-bd-danger focus:ring-bd-danger/30 dark:focus:ring-bd-danger-dark/30'
                          : 'border-bd-base dark:border-bd-base-dark focus:ring-bd-base dark:focus:ring-bd-base-dark',
                      ].join(' ')}
                    />

                    {/* Remove */}
                    {colorRows.length > 1 && (
                      <button
                        onClick={() => removeRow(row.id)}
                        className="text-fg-placeholder dark:text-fg-muted-dark hover:text-fg-muted dark:hover:text-fg-subtle-dark transition-colors"
                        aria-label="Remove color"
                      >
                        <IconTrash size={15} />
                      </button>
                    )}
                  </div>
                ))}

                {colorRows.length < 3 && (
                  <button
                    onClick={addRow}
                    className="flex items-center gap-1.5 text-xs text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark transition-colors mt-0.5 self-start"
                  >
                    <IconPlus size={13} />
                    Add color
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={goBack}
                  className="px-4 py-2 rounded-lg border border-bd-base dark:border-bd-base-dark text-sm text-fg-subtle dark:text-fg-subtle-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleBrandedNext}
                  disabled={brandHexes.length === 0}
                  className="px-4 py-2 rounded-lg bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-fg-inverted dark:text-fg-inverted-dark text-sm font-medium hover:bg-surface-neutral-strong-hover dark:hover:bg-surface-neutral-strong-hover-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* ── Branded: Harmonies ─────────────────────────────────────────── */}
          {step === 'branded-harmonies' && (
            <div className="flex flex-col gap-5">
              {/* Brand color recap */}
              <div>
                <p className="text-xs font-medium text-fg-muted dark:text-fg-muted-dark uppercase tracking-wide mb-2">Your brand colors</p>
                <div className="flex gap-2 flex-wrap">
                  {brandHexes.map((hex, i) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-bd-base dark:border-bd-base-dark bg-surface-neutral-subtle-hover dark:bg-surface-neutral-subtle-hover-dark">
                      <div
                        className="w-4 h-4 rounded border border-black/10 dark:border-white/10 flex-shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      <span className="text-xs font-mono text-fg-muted dark:text-fg-muted-dark">{hex}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Harmony options */}
              {primaryHex && (
                <div>
                  <p className="text-xs font-medium text-fg-muted dark:text-fg-muted-dark uppercase tracking-wide mb-2">Add harmonies</p>
                  <p className="text-xs text-fg-placeholder dark:text-fg-placeholder-dark mb-3">Based on your primary color. Skip if you want only your brand colors.</p>
                  <div className="flex flex-col gap-2">
                    {HARMONY_DEFS.map((def) => {
                      const harmonyHexes = def.hueShifts.map((shift) => shiftHue(primaryHex, shift))
                      const isSelected = selectedHarmonies.has(def.id)
                      return (
                        <button
                          key={def.id}
                          onClick={() => toggleHarmony(def.id)}
                          className={[
                            'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                            isSelected
                              ? 'border-bd-primary dark:border-bd-primary-dark bg-surface-neutral-subtle-hover dark:bg-surface-neutral-subtle-hover-dark'
                              : 'border-bd-base dark:border-bd-base-dark hover:border-bd-hover dark:hover:border-bd-hover-dark',
                          ].join(' ')}
                        >
                          {/* Checkbox */}
                          <div
                            className={[
                              'w-4 h-4 rounded flex-shrink-0 flex items-center justify-center border transition-colors',
                              isSelected
                                ? 'bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark border-bd-primary dark:border-bd-primary-dark'
                                : 'border-bd-hover dark:border-bd-hover-dark',
                            ].join(' ')}
                          >
                            {isSelected && (
                              <IconCheck
                                size={10}
                                className="text-fg-inverted dark:text-fg-inverted-dark"
                                strokeWidth={3}
                              />
                            )}
                          </div>

                          {/* Label + description */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-fg-base dark:text-fg-base-dark leading-tight">{def.label}</div>
                            <div className="text-xs text-fg-placeholder dark:text-fg-placeholder-dark mt-0.5">{def.description}</div>
                          </div>

                          {/* Color swatches */}
                          <div className="flex gap-1 flex-shrink-0">
                            <div
                              className="w-5 h-5 rounded border border-black/10 dark:border-white/10"
                              style={{ backgroundColor: primaryHex }}
                              title="Primary"
                            />
                            {harmonyHexes.map((hex, j) => (
                              <div
                                key={j}
                                className="w-5 h-5 rounded border border-black/10 dark:border-white/10"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={goBack}
                  className="px-4 py-2 rounded-lg border border-bd-base dark:border-bd-base-dark text-sm text-fg-subtle dark:text-fg-subtle-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateBranded}
                  className="px-4 py-2 rounded-lg bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-fg-inverted dark:text-fg-inverted-dark text-sm font-medium hover:bg-surface-neutral-strong-hover dark:hover:bg-surface-neutral-strong-hover-dark transition-colors"
                >
                  Create project
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
