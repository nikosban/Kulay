import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { IconTrash, IconX, IconLock, IconLockOpen } from '@tabler/icons-react'
import type { Palette, PaletteStep, PalettePreset } from '../../types/project'
import { DEFAULT_LIGHTNESS_RANGE, DEFAULT_PRESET, PALETTE_PRESETS, getActiveSteps } from '../../types/project'
import { useProjectStore } from '../../store/useProjectStore'
import { contrastRatio, wcagLabel, relativeLuminance } from '../../lib/wcag'
import { parseColorInput } from '../../lib/colorInput'

interface Props {
  palette: Palette
  step: PaletteStep
  onClose: () => void
}

function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map(
    (x) => parseInt(x, 16) / 255
  ) as [number, number, number]
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    s = (max - min) / (1 - Math.abs(2 * l - 1))
    if (max === r) h = ((g - b) / (max - min) + 6) % 6
    else if (max === g) h = (b - r) / (max - min) + 2
    else h = (r - g) / (max - min) + 4
    h *= 60
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)]
}

function writeToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  // Fallback for environments without Clipboard API
  return new Promise((resolve, reject) => {
    const el = document.createElement('textarea')
    el.value = text
    el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    document.body.appendChild(el)
    el.focus()
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    ok ? resolve() : reject(new Error('execCommand failed'))
  })
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const lineCount = text.split('\n').length
  function copy() {
    writeToClipboard(text)
      .then(() => {
        setCopied(true)
        toast.success(`${lineCount} value${lineCount > 1 ? 's' : ''} copied`)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => toast.error('Copy failed — try selecting and copying manually'))
  }
  return (
    <button
      onClick={copy}
      title="Copy"
      className="w-7 h-7 flex items-center justify-center rounded text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-muted dark:hover:text-fg-subtle-dark hover:bg-surface-neutral-subtle-active dark:hover:bg-surface-neutral-subtle-active-dark transition-colors flex-shrink-0"
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M3 8l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="5.5" y="5.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <path d="M10.5 5.5V4.5C10.5 3.95 10.05 3.5 9.5 3.5H4.5C3.95 3.5 3.5 3.95 3.5 4.5V9.5C3.5 10.05 3.95 10.5 4.5 10.5H5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}

function EditableMultiValueRow({
  keys,
  displays,
  rawValues,
  copyText,
  buildColor,
  onCommit,
}: {
  keys: string[]
  displays: string[]
  rawValues: string[]
  copyText: string
  buildColor: (editedIdx: number, newVal: string, currentRaw: string[]) => string
  onCommit: (colorStr: string) => void
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  return (
    <div className="flex items-center gap-1">
      <div className="flex flex-1 rounded-lg overflow-hidden border border-bd-base dark:border-bd-hover-dark divide-x divide-bd-base dark:divide-bd-hover-dark">
        {keys.map((key, idx) => (
          <div key={key} className="flex items-center gap-1 px-2 py-1.5 flex-1 min-w-0 bg-surface-control dark:bg-surface-control-dark">
            <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark flex-shrink-0">{key}</span>
            {editingIdx === idx ? (
              <input
                autoFocus
                type="text"
                className="flex-1 min-w-0 text-[11px] font-mono text-fg-subtle dark:text-fg-subtle-dark bg-transparent outline-none"
                value={editValue}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => {
                  onCommit(buildColor(idx, editValue, rawValues))
                  setEditingIdx(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setEditingIdx(null)
                }}
              />
            ) : (
              <span
                className="flex-1 min-w-0 text-[11px] font-mono text-fg-subtle dark:text-fg-subtle-dark truncate cursor-text"
                onClick={() => { setEditingIdx(idx); setEditValue(rawValues[idx]!) }}
              >
                {displays[idx]}
              </span>
            )}
          </div>
        ))}
      </div>
      <CopyButton text={copyText} />
    </div>
  )
}


export function StepDetailPanel({ palette, step, onClose }: Props) {
  const updateStepHex = useProjectStore((s) => s.updateStepHex)
  const lockStep = useProjectStore((s) => s.lockStep)
  const unlockStep = useProjectStore((s) => s.unlockStep)
  const deleteStep = useProjectStore((s) => s.deleteStep)
  const recalibratePaletteToStep = useProjectStore((s) => s.recalibratePaletteToStep)
  const updatePaletteLightnessRange = useProjectStore((s) => s.updatePaletteLightnessRange)
  const applyPalettePreset = useProjectStore((s) => s.applyPalettePreset)
  const updatePaletteEnvelopeExponent = useProjectStore((s) => s.updatePaletteEnvelopeExponent)
  const updatePaletteLightnessDistribution = useProjectStore((s) => s.updatePaletteLightnessDistribution)
  const renamePalette = useProjectStore((s) => s.renamePalette)
  const projectLightnessRange = useProjectStore((s) => s.activeProject?.lightnessRange ?? DEFAULT_LIGHTNESS_RANGE)
  const backgrounds = useProjectStore((s) => s.activeProject?.backgrounds ?? { light: '#FFFFFF', dark: '#000000' })

  const activePreset: PalettePreset = palette.preset ?? DEFAULT_PRESET
  const effectiveRange = activePreset === 'manual'
    ? (palette.lightnessRange ?? projectLightnessRange)
    : PALETTE_PRESETS[activePreset].lightnessRange
  const effectiveExponent = activePreset === 'manual'
    ? (palette.envelopeExponent ?? 0.75)
    : PALETTE_PRESETS[activePreset].envelopeExponent
  const effectiveDist = activePreset === 'manual'
    ? (palette.lightnessDistribution ?? 'linear')
    : PALETTE_PRESETS[activePreset].lightnessDistribution

  // ── Inline name editing ───────────────────────────────────────────────────
  const [nameEditing, setNameEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')

  function startNameEdit() {
    setNameInput(palette.name)
    setNameEditing(true)
  }

  function commitName() {
    setNameEditing(false)
    const trimmed = nameInput.trim()
    if (trimmed && trimmed !== palette.name) renamePalette(palette.id, trimmed)
  }

  function cancelNameEdit() {
    setNameEditing(false)
    setNameInput(palette.name)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const allSteps = getActiveSteps(palette)
  const canDelete = allSteps.length > 2

  const [hexInput, setHexInput] = useState('')
  const [hexEditing, setHexEditing] = useState(false)
  const [hexError, setHexError] = useState('')

  const { l, c, h } = step.oklch
  const [hslH, hslS, hslL] = hexToHsl(step.hex)
  const rgbR = parseInt(step.hex.slice(1, 3), 16)
  const rgbG = parseInt(step.hex.slice(3, 5), 16)
  const rgbB = parseInt(step.hex.slice(5, 7), 16)

  const stepName = `${palette.name}-${step.label}`

  // Full-ramp copy strings — copy all steps in that format
  const rampHexCopy = allSteps.map((s) => s.hex.toUpperCase()).join('\n')
  const rampOklchCopy = allSteps.map((s) =>
    `oklch(${s.oklch.l.toFixed(3)} ${s.oklch.c.toFixed(3)} ${s.oklch.h.toFixed(1)})`,
  ).join('\n')
  const rampHslCopy = allSteps.map((s) => {
    const [sH, sS, sL] = hexToHsl(s.hex)
    return `hsl(${sH}, ${sS}%, ${sL}%)`
  }).join('\n')
  const rampRgbCopy = allSteps.map((s) =>
    `rgb(${parseInt(s.hex.slice(1, 3), 16)}, ${parseInt(s.hex.slice(3, 5), 16)}, ${parseInt(s.hex.slice(5, 7), 16)})`,
  ).join('\n')

  function commitColor(colorStr: string) {
    const result = parseColorInput(colorStr)
    if (!result.ok) return
    updateStepHex(palette.id, step.label, result.hex)
  }

  function commitHex(raw: string) {
    setHexEditing(false)
    const result = parseColorInput(raw)
    if (!result.ok) { setHexError(result.error); return }
    setHexError('')
    updateStepHex(palette.id, step.label, result.hex)
  }

  return (
    <div className="w-[300px] flex-shrink-0 border-l border-bd-base dark:border-bd-base-dark bg-surface-sunken dark:bg-surface-sunken-dark flex flex-col overflow-y-auto">

      {/* ── Palette ── */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-bd-base dark:border-bd-base-dark flex-shrink-0">
        {nameEditing ? (
          <input
            autoFocus
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') cancelNameEdit()
            }}
            onFocus={(e) => e.target.select()}
            spellCheck={false}
            className="flex-1 min-w-0 text-[13px] font-semibold text-fg-base dark:text-fg-base-dark bg-transparent outline-none border-b border-bd-strong dark:border-bd-strong-dark pb-px"
          />
        ) : (
          <button
            onClick={startNameEdit}
            title="Click to rename"
            className="flex-1 min-w-0 text-left text-[13px] font-semibold text-fg-base dark:text-fg-base-dark truncate hover:opacity-60 transition-opacity"
          >
            {palette.name}
          </button>
        )}
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="w-7 h-7 flex items-center justify-center rounded text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark hover:bg-surface-neutral-subtle-active dark:hover:bg-surface-neutral-subtle-active-dark transition-colors flex-shrink-0"
        >
          <IconX size={14} stroke={1.75} />
        </button>
      </div>

      {/* ── Preset ── */}
      <div className="flex flex-col gap-2.5 p-3 border-b border-bd-base dark:border-bd-base-dark">
        <div className="grid grid-cols-3 gap-1">
          {(['balanced', 'vivid', 'muted', 'soft', 'high-contrast', 'manual'] as PalettePreset[]).map((p) => {
            const label = p === 'manual' ? 'Manual' : PALETTE_PRESETS[p].label
            return (
              <button
                key={p}
                onClick={() => applyPalettePreset(palette.id, p)}
                className={`py-1.5 rounded-md text-[10px] font-medium transition-colors border ${
                  activePreset === p
                    ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark border-bd-strong dark:border-bd-strong-dark text-fg-base dark:text-fg-base-dark'
                    : 'border-bd-base dark:border-bd-base-dark text-fg-muted dark:text-fg-muted-dark hover:border-bd-hover dark:hover:border-bd-hover-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Manual controls — only shown when preset === 'manual' */}
        {activePreset === 'manual' && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark w-12">Lightest</span>
              <input
                type="range" min={75} max={99} step={1}
                aria-label="Lightest"
                value={Math.round(effectiveRange.lightest * 100)}
                onChange={(e) => updatePaletteLightnessRange(palette.id, { ...effectiveRange, lightest: Number(e.target.value) / 100 })}
                className="flex-1 accent-neutral-700 dark:accent-neutral-300"
              />
              <span className="text-[10px] tabular-nums text-fg-muted dark:text-fg-muted-dark w-6 text-right">
                {Math.round(effectiveRange.lightest * 100)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark w-12">Darkest</span>
              <input
                type="range" min={5} max={30} step={1}
                aria-label="Darkest"
                value={Math.round(effectiveRange.darkest * 100)}
                onChange={(e) => updatePaletteLightnessRange(palette.id, { ...effectiveRange, darkest: Number(e.target.value) / 100 })}
                className="flex-1 accent-neutral-700 dark:accent-neutral-300"
              />
              <span className="text-[10px] tabular-nums text-fg-muted dark:text-fg-muted-dark w-6 text-right">
                {Math.round(effectiveRange.darkest * 100)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark w-12">Expressive</span>
              <input
                type="range" min={40} max={140} step={5}
                aria-label="Envelope exponent"
                value={Math.round(effectiveExponent * 100)}
                onChange={(e) => updatePaletteEnvelopeExponent(palette.id, Number(e.target.value) / 100)}
                className="flex-1 accent-neutral-700 dark:accent-neutral-300"
              />
              <span className="text-[10px] tabular-nums text-fg-muted dark:text-fg-muted-dark w-6 text-right">
                {effectiveExponent.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center rounded-md border border-bd-base dark:border-bd-base-dark overflow-hidden">
              {(['linear', 'perceptual'] as const).map((val) => (
                <button
                  key={val}
                  onClick={() => updatePaletteLightnessDistribution(palette.id, val)}
                  className={`flex-1 py-1 text-[10px] capitalize transition-colors ${
                    effectiveDist === val
                      ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark text-fg-base dark:text-fg-base-dark font-medium'
                      : 'text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Preview ── */}
      <div className="flex flex-col gap-2 p-3 border-b border-bd-base dark:border-bd-base-dark">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-fg-placeholder dark:text-fg-placeholder-dark">Preview</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-fg-muted dark:text-fg-subtle-dark">{stepName}</span>
            {step.isBase && <span className="text-[9px] text-fg-placeholder dark:text-fg-placeholder-dark">Base</span>}
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-5 h-5 flex items-center justify-center rounded text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark hover:bg-surface-neutral-subtle-active dark:hover:bg-surface-neutral-subtle-active-dark transition-colors text-base leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className="w-full h-24 rounded-lg flex-shrink-0" style={{ backgroundColor: step.hex }} />

        <button
          onClick={() => recalibratePaletteToStep(palette.id, step.label)}
          className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-bd-base dark:border-bd-base-dark text-fg-muted dark:text-fg-muted-dark hover:border-bd-strong dark:hover:border-bd-strong-dark hover:text-fg-base dark:hover:text-fg-base-dark bg-surface-control dark:bg-surface-control-dark transition-colors"
        >
          Recalibrate scale
        </button>

        <button
          onClick={() => { deleteStep(palette.id, step.label); onClose() }}
          disabled={!canDelete}
          className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg border border-bd-base dark:border-bd-base-dark text-fg-placeholder dark:text-fg-placeholder-dark hover:border-bd-danger dark:hover:border-bd-danger-dark hover:text-fg-danger dark:hover:text-fg-danger-dark hover:bg-surface-danger-subtle-rest dark:hover:bg-surface-danger-subtle-rest-dark bg-surface-control dark:bg-surface-control-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <IconTrash size={12} stroke={1.75} />
          Delete step
        </button>
      </div>

      {/* ── Values ── */}
      <div className="flex flex-col gap-2 p-3 border-b border-bd-base dark:border-bd-base-dark">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-fg-muted dark:text-fg-muted-dark">Values</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">{stepName}</span>
            <button
              onClick={() => step.locked ? unlockStep(palette.id, step.label) : lockStep(palette.id, step.label)}
              title={step.locked ? 'Unlock step' : 'Lock step'}
              aria-label={step.locked ? 'Unlock step' : 'Lock step'}
              className="w-5 h-5 flex items-center justify-center rounded text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-muted dark:hover:text-fg-muted-dark hover:bg-surface-neutral-subtle-active dark:hover:bg-surface-neutral-subtle-active-dark transition-colors"
            >
              {step.locked
                ? <IconLock size={11} stroke={1.75} />
                : <IconLockOpen size={11} stroke={1.75} />
              }
            </button>
          </div>
        </div>

        {/* Hex */}
        <div className="flex items-center gap-1">
          <div className={`flex items-center flex-1 gap-1.5 px-2 py-1.5 bg-surface-control dark:bg-surface-control-dark rounded-lg border transition-colors ${
            hexError ? 'border-bd-danger' : 'border-bd-base dark:border-bd-hover-dark focus-within:border-bd-strong'
          }`}>
            <div className="relative w-4 h-4 rounded flex-shrink-0 overflow-hidden cursor-pointer" style={{ backgroundColor: step.hex }}>
              <input
                type="color"
                value={step.hex}
                onChange={(e) => commitColor(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                title="Pick color"
              />
            </div>
            <input
              type="text"
              className="flex-1 min-w-0 text-[11px] font-mono text-fg-base dark:text-fg-subtle-dark bg-transparent outline-none"
              value={hexEditing ? hexInput : step.hex.toUpperCase()}
              onFocus={(e) => { setHexInput(step.hex.toUpperCase()); setHexEditing(true); setHexError(''); e.target.select() }}
              onChange={(e) => setHexInput(e.target.value)}
              onBlur={(e) => commitHex(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
              spellCheck={false}
            />
            <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark flex-shrink-0">100%</span>
          </div>
          <CopyButton text={rampHexCopy} />
        </div>
        {hexError && <p className="text-[10px] text-fg-danger -mt-1">{hexError}</p>}

        {/* OKLCH */}
        <EditableMultiValueRow
          keys={['L', 'C', 'H']}
          displays={[`${(l * 100).toFixed(1)}%`, c.toFixed(3), h.toFixed(1)]}
          rawValues={[l.toFixed(4), c.toFixed(4), h.toFixed(2)]}
          copyText={rampOklchCopy}
          buildColor={(idx, val, raw) => {
            const v = raw.map((r, i) => i === idx ? val : r)
            return `oklch(${v[0]} ${v[1]} ${v[2]})`
          }}
          onCommit={commitColor}
        />

        {/* HSL */}
        <EditableMultiValueRow
          keys={['H', 'S', 'L']}
          displays={[`${hslH}°`, `${hslS}%`, `${hslL}%`]}
          rawValues={[String(hslH), String(hslS), String(hslL)]}
          copyText={rampHslCopy}
          buildColor={(idx, val, raw) => {
            const v = raw.map((r, i) => i === idx ? val : r)
            return `hsl(${v[0]}, ${v[1]}%, ${v[2]}%)`
          }}
          onCommit={commitColor}
        />

        {/* RGB */}
        <EditableMultiValueRow
          keys={['R', 'G', 'B']}
          displays={[String(rgbR), String(rgbG), String(rgbB)]}
          rawValues={[String(rgbR), String(rgbG), String(rgbB)]}
          copyText={rampRgbCopy}
          buildColor={(idx, val, raw) => {
            const v = raw.map((r, i) => i === idx ? val : r)
            return `rgb(${v[0]}, ${v[1]}, ${v[2]})`
          }}
          onCommit={commitColor}
        />
      </div>

      {/* ── WCAG Check ── */}
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-fg-muted dark:text-fg-muted-dark">WCAG Check</span>
        </div>

        {/* Column labels */}
        <div className="flex items-center gap-2 px-2">
          <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark flex-1 text-left">Step</span>
          <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark w-10 text-right">Ratio</span>
          <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark w-[52px] text-center">Level</span>
        </div>

        {/* Background rows */}
        <div className="flex flex-col gap-0.5">
          {([
            { label: 'Light bg', hex: backgrounds.light, cr: step.contrast.onLight },
            { label: 'Dark bg',  hex: backgrounds.dark,  cr: step.contrast.onDark  },
          ] as const).map(({ label, hex, cr }) => {
            const lum = relativeLuminance(hex)
            const textColor = lum > 0.18 ? '#111111' : '#ffffff'
            const badgeBg = lum > 0.18 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.15)'
            const level = wcagLabel(cr)
            return (
              <div
                key={label}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                style={{ backgroundColor: hex }}
              >
                <span className="flex-1 text-[11px] leading-none" style={{ color: textColor }}>{label}</span>
                <span className="text-[11px] font-mono w-10 text-right leading-none" style={{ color: textColor, opacity: 0.8 }}>{cr.toFixed(2)}</span>
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded w-[52px] text-center leading-tight" style={{ color: textColor, backgroundColor: badgeBg }}>{level}</span>
              </div>
            )
          })}
        </div>

        <div className="border-t border-bd-base dark:border-bd-base-dark" />

        {/* Step rows */}
        <div className="flex flex-col gap-0.5">
          {allSteps.map((bgStep) => {
            const isCurrent = bgStep.label === step.label
            const cr = contrastRatio(step.hex, bgStep.hex)
            const level = wcagLabel(cr)
            const lum = relativeLuminance(bgStep.hex)
            const textColor = lum > 0.18 ? '#111111' : '#ffffff'
            const badgeBg = lum > 0.18 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.15)'

            return (
              <div
                key={bgStep.label}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
                  isCurrent ? 'ring-2 ring-inset ring-black/20 dark:ring-white/20' : ''
                }`}
                style={{ backgroundColor: bgStep.hex }}
              >
                <span
                  className={`flex-1 text-[11px] font-mono leading-none ${isCurrent ? 'font-semibold' : ''}`}
                  style={{ color: textColor }}
                >
                  {bgStep.label}
                </span>
                <span
                  className="text-[11px] font-mono w-10 text-right leading-none"
                  style={{ color: textColor, opacity: 0.8 }}
                >
                  {cr.toFixed(2)}
                </span>
                <span
                  className="text-[9px] font-semibold px-1.5 py-0.5 rounded w-[52px] text-center leading-tight"
                  style={{ color: textColor, backgroundColor: badgeBg }}
                >
                  {level}
                </span>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
