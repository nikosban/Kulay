import { useState, useEffect, type ReactNode } from 'react'
import { toast } from 'sonner'
import { IconChevronDown, IconChevronRight, IconPencil, IconTrash, IconLock, IconLockOpen } from '@tabler/icons-react'
import type { Palette, PaletteStep, PalettePreset } from '../../types/project'
import { DEFAULT_LIGHTNESS_RANGE, DEFAULT_PRESET, PALETTE_PRESETS, getActiveSteps } from '../../types/project'
import { useProjectStore } from '../../store/useProjectStore'
import { contrastRatio, wcagLabel, relativeLuminance } from '../../lib/wcag'
import { parseColorInput } from '../../lib/colorInput'
import { parseCurveInputValue } from '../../lib/curveChart'

interface Props {
  palette: Palette
  step: PaletteStep
  onClose: () => void
  curveTools?: ReactNode
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

function EditableNumberInput({
  value,
  min,
  max,
  step,
  decimals = 0,
  ariaLabel,
  onCommit,
}: {
  value: number
  min: number
  max: number
  step: number
  decimals?: number
  ariaLabel: string
  onCommit: (value: number) => void
}) {
  const [draft, setDraft] = useState(value.toFixed(decimals))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setDraft(value.toFixed(decimals))
  }, [value, decimals, editing])

  function commit() {
    const parsed = Number(draft)
    if (Number.isFinite(parsed)) onCommit(Math.max(min, Math.min(max, parsed)))
    else setDraft(value.toFixed(decimals))
    setEditing(false)
  }

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      aria-label={`${ariaLabel} value`}
      value={draft}
      onFocus={(e) => { setEditing(true); e.target.select() }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(value.toFixed(decimals))
          setEditing(false)
          e.currentTarget.blur()
        }
      }}
      className="w-10 rounded border border-transparent bg-transparent px-1 py-0.5 text-right text-[10px] tabular-nums text-fg-muted outline-none hover:border-bd-base focus:border-bd-strong dark:text-fg-muted-dark dark:hover:border-bd-base-dark dark:focus:border-bd-strong-dark"
    />
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
            <input
              type="text"
              aria-label={`${key} value`}
              className="flex-1 min-w-0 text-[11px] font-mono text-fg-subtle dark:text-fg-subtle-dark bg-transparent outline-none"
              value={editingIdx === idx ? editValue : displays[idx]}
              onFocus={(e) => {
                setEditingIdx(idx)
                setEditValue(rawValues[idx]!)
                requestAnimationFrame(() => e.target.select())
              }}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => {
                const parsed = parseCurveInputValue(editValue)
                if (editingIdx === idx && parsed !== null) onCommit(buildColor(idx, String(parsed), rawValues))
                setEditingIdx(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur()
                if (e.key === 'Escape') {
                  setEditingIdx(null)
                  e.currentTarget.blur()
                }
              }}
            />
          </div>
        ))}
      </div>
      <CopyButton text={copyText} />
    </div>
  )
}


export function StepDetailPanel({ palette, step, onClose, curveTools }: Props) {
  const updateStepHex = useProjectStore((s) => s.updateStepHex)
  const lockStep = useProjectStore((s) => s.lockStep)
  const unlockStep = useProjectStore((s) => s.unlockStep)
  const deleteStep = useProjectStore((s) => s.deleteStep)
  const recalibratePaletteToStep = useProjectStore((s) => s.recalibratePaletteToStep)
  const updatePaletteLightnessRange = useProjectStore((s) => s.updatePaletteLightnessRange)
  const applyPalettePreset = useProjectStore((s) => s.applyPalettePreset)
  const updatePaletteCurve = useProjectStore((s) => s.updatePaletteCurve)
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
  const lightFalloff = palette.lightChromaFalloff ?? effectiveExponent
  const darkFalloff = palette.darkChromaFalloff ?? effectiveExponent
  const lightHueShift = palette.lightHueShift ?? 0
  const darkHueShift = palette.darkHueShift ?? 0

  // ── Inline name editing ───────────────────────────────────────────────────
  const [nameEditing, setNameEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [previewOpen, setPreviewOpen] = useState(true)
  const [curveOpen, setCurveOpen] = useState(false)
  const [wcagOpen, setWcagOpen] = useState(false)

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
            className="group/name flex flex-1 min-w-0 items-center gap-1.5 text-left text-[13px] font-semibold text-fg-base dark:text-fg-base-dark"
          >
            <span className="truncate">{palette.name}</span>
            <IconPencil
              size={12}
              stroke={1.75}
              className="flex-shrink-0 text-fg-placeholder dark:text-fg-placeholder-dark opacity-0 group-hover/name:opacity-100 transition-opacity"
            />
          </button>
        )}
        <button
          onClick={onClose}
          title="Collapse inspector"
          aria-label="Collapse inspector"
          className="w-7 h-7 flex items-center justify-center rounded text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark hover:bg-surface-neutral-subtle-active dark:hover:bg-surface-neutral-subtle-active-dark transition-colors flex-shrink-0"
        >
          <IconChevronRight size={14} stroke={1.75} />
        </button>
      </div>

      {curveTools}

      {/* ── Preset ── */}
      <div className="order-2 flex flex-col gap-2.5 p-3 border-b border-bd-base dark:border-bd-base-dark">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setCurveOpen((open) => !open)}
            aria-expanded={curveOpen}
            className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-medium text-fg-muted dark:text-fg-muted-dark"
          >
            <IconChevronDown size={13} stroke={1.75} className={`transition-transform ${curveOpen ? '' : '-rotate-90'}`} />
            Starting curve
          </button>
          <div className="relative group/tip">
            <span
              className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark cursor-default select-none"
              style={{ textDecoration: 'underline', textDecorationStyle: 'wavy', textUnderlineOffset: '3px' }}
            >
              How this works
            </span>
            <div className="pointer-events-none absolute right-0 top-full mt-2 w-60 z-50 opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150">
              <div className="bg-surface-base dark:bg-surface-base-dark border border-bd-base dark:border-bd-base-dark rounded-lg shadow-lg p-3 text-[10px] text-fg-subtle dark:text-fg-subtle-dark leading-relaxed space-y-1.5">
                <p>Recipes initialize the same editable curve. Adjusting any control switches the palette to Custom.</p>
                <ul className="space-y-1 text-fg-placeholder dark:text-fg-placeholder-dark">
                  <li><span className="text-fg-subtle dark:text-fg-subtle-dark font-medium">Balanced</span> — general purpose, works for most hues.</li>
                  <li><span className="text-fg-subtle dark:text-fg-subtle-dark font-medium">Vivid</span> — pushes chroma up for more saturated colors.</li>
                  <li><span className="text-fg-subtle dark:text-fg-subtle-dark font-medium">Muted</span> — lower chroma, flatter and softer tones.</li>
                  <li><span className="text-fg-subtle dark:text-fg-subtle-dark font-medium">Soft</span> — lighter range, good for backgrounds and tints.</li>
                  <li><span className="text-fg-subtle dark:text-fg-subtle-dark font-medium">High contrast</span> — stretches from near-white to near-black.</li>
                  <li><span className="text-fg-subtle dark:text-fg-subtle-dark font-medium">Custom</span> — keeps the current curve and exposes direct controls.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        {curveOpen && (<>
        <div className="grid grid-cols-3 gap-1">
          {(['balanced', 'vivid', 'muted', 'soft', 'high-contrast', 'manual'] as PalettePreset[]).map((p) => {
            const label = p === 'manual' ? 'Custom' : PALETTE_PRESETS[p].label
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

        {/* Curve controls remain available after applying any starting recipe. */}
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
              <EditableNumberInput
                value={Math.round(effectiveRange.lightest * 100)} min={75} max={99} step={1}
                ariaLabel="Lightest"
                onCommit={(value) => updatePaletteLightnessRange(palette.id, { ...effectiveRange, lightest: value / 100 })}
              />
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
              <EditableNumberInput
                value={Math.round(effectiveRange.darkest * 100)} min={5} max={30} step={1}
                ariaLabel="Darkest"
                onCommit={(value) => updatePaletteLightnessRange(palette.id, { ...effectiveRange, darkest: value / 100 })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark w-12">Light fade</span>
              <input
                type="range" min={30} max={180} step={5}
                aria-label="Light chroma falloff"
                value={Math.round(lightFalloff * 100)}
                onChange={(e) => updatePaletteCurve(palette.id, { lightChromaFalloff: Number(e.target.value) / 100 })}
                className="flex-1 accent-neutral-700 dark:accent-neutral-300"
              />
              <EditableNumberInput
                value={lightFalloff} min={0.3} max={1.8} step={0.05} decimals={2}
                ariaLabel="Light chroma falloff"
                onCommit={(value) => updatePaletteCurve(palette.id, { lightChromaFalloff: value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark w-12">Dark fade</span>
              <input
                type="range" min={30} max={180} step={5}
                aria-label="Dark chroma falloff"
                value={Math.round(darkFalloff * 100)}
                onChange={(e) => updatePaletteCurve(palette.id, { darkChromaFalloff: Number(e.target.value) / 100 })}
                className="flex-1 accent-neutral-700 dark:accent-neutral-300"
              />
              <EditableNumberInput
                value={darkFalloff} min={0.3} max={1.8} step={0.05} decimals={2}
                ariaLabel="Dark chroma falloff"
                onCommit={(value) => updatePaletteCurve(palette.id, { darkChromaFalloff: value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark w-12">Light hue</span>
              <input
                type="range" min={-20} max={20} step={1}
                aria-label="Light hue shift"
                value={lightHueShift}
                onChange={(e) => updatePaletteCurve(palette.id, { lightHueShift: Number(e.target.value) })}
                className="flex-1 accent-neutral-700 dark:accent-neutral-300"
              />
              <EditableNumberInput
                value={lightHueShift} min={-20} max={20} step={1}
                ariaLabel="Light hue shift"
                onCommit={(value) => updatePaletteCurve(palette.id, { lightHueShift: value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark w-12">Dark hue</span>
              <input
                type="range" min={-20} max={20} step={1}
                aria-label="Dark hue shift"
                value={darkHueShift}
                onChange={(e) => updatePaletteCurve(palette.id, { darkHueShift: Number(e.target.value) })}
                className="flex-1 accent-neutral-700 dark:accent-neutral-300"
              />
              <EditableNumberInput
                value={darkHueShift} min={-20} max={20} step={1}
                ariaLabel="Dark hue shift"
                onCommit={(value) => updatePaletteCurve(palette.id, { darkHueShift: value })}
              />
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
        </>)}
      </div>

      {/* ── Preview and values ── */}
      <div className={`order-1 flex flex-col gap-2 p-3 ${previewOpen ? '' : 'border-b border-bd-base dark:border-bd-base-dark'}`}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPreviewOpen((open) => !open)}
            aria-expanded={previewOpen}
            className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-medium text-fg-muted dark:text-fg-muted-dark"
          >
            <IconChevronDown size={13} stroke={1.75} className={`transition-transform ${previewOpen ? '' : '-rotate-90'}`} />
            Preview &amp; values
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-fg-muted dark:text-fg-subtle-dark">{stepName}</span>
            {step.isBase && <span className="text-[9px] text-fg-placeholder dark:text-fg-placeholder-dark">Base</span>}
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

        {previewOpen && (<>
        <div className="w-full h-24 rounded-lg flex-shrink-0" style={{ backgroundColor: step.hex }} />

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => recalibratePaletteToStep(palette.id, step.label)}
            className="flex-1 flex items-center justify-center text-xs py-1.5 rounded-lg border border-bd-base dark:border-bd-base-dark text-fg-muted dark:text-fg-muted-dark hover:border-bd-strong dark:hover:border-bd-strong-dark hover:text-fg-base dark:hover:text-fg-base-dark bg-surface-control dark:bg-surface-control-dark transition-colors"
          >
            Recalibrate
          </button>
          <button
            onClick={() => { deleteStep(palette.id, step.label); onClose() }}
            disabled={!canDelete}
            title="Delete step"
            aria-label="Delete step"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-bd-base dark:border-bd-base-dark text-fg-placeholder dark:text-fg-placeholder-dark hover:border-bd-danger dark:hover:border-bd-danger-dark hover:text-fg-danger dark:hover:text-fg-danger-dark hover:bg-surface-danger-subtle-rest dark:hover:bg-surface-danger-subtle-rest-dark bg-surface-control dark:bg-surface-control-dark disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <IconTrash size={13} stroke={1.75} />
          </button>
        </div>
        </>)}
      </div>

      {/* ── Values ── */}
      {previewOpen && (<div className="order-1 flex flex-col gap-2 px-3 pb-3 border-b border-bd-base dark:border-bd-base-dark">
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
      </div>)}

      {/* ── WCAG Check ── */}
      <div className="order-3 flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWcagOpen((open) => !open)}
            aria-expanded={wcagOpen}
            className="flex flex-1 items-center gap-1.5 text-left text-[11px] font-medium text-fg-muted dark:text-fg-muted-dark"
          >
            <IconChevronDown size={13} stroke={1.75} className={`transition-transform ${wcagOpen ? '' : '-rotate-90'}`} />
            WCAG
          </button>
        </div>

        {wcagOpen && (<>
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
                className={`flex items-center gap-2 px-2 rounded-lg ${
                  isCurrent ? 'py-2.5 ring-2 ring-inset ring-black/20 dark:ring-white/20' : 'py-1.5'
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
        </>)}
      </div>

    </div>
  )
}
