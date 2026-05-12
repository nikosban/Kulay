import { useRef, useState, useEffect } from 'react'
import { toast } from 'sonner'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useProjectStore } from '../../store/useProjectStore'
import { getActiveSteps } from '../../types/project'
import { generatePalette, validateBasePosition } from '../../lib/generatePalette'
import { oklchToHex, clampToGamut } from '../../lib/color'
import { sanitizeHex } from '../../lib/hexInput'

const PALETTE_LIMIT = 10

function generateRandomHex(
  stepCount: number,
  lightnessRange: { lightest: number; darkest: number },
): string | null {
  for (let i = 0; i < 30; i++) {
    const H = Math.random() * 360
    const C = 0.16 + Math.random() * 0.18
    const L = 0.44 + Math.random() * 0.22
    const [cL, cC, cH] = clampToGamut(L, C, H)
    const hex = oklchToHex(cL, cC, cH)
    if (validateBasePosition(hex, stepCount, lightnessRange) === null) return hex
  }
  return null
}

interface Props {
  onBack: () => void
  selectedPaletteId: string | null
  onSelectPalette: (id: string | null) => void
}

export function ProjectSidebar({ onBack, selectedPaletteId, onSelectPalette }: Props) {
  const activeProject = useProjectStore((s) => s.activeProject)
  const addPalette = useProjectStore((s) => s.addPalette)
  const deletePalette = useProjectStore((s) => s.deletePalette)
  const undoDeletePalette = useProjectStore((s) => s.undoDeletePalette)
  const projectName = useProjectStore((s) => s.activeProject?.name ?? '')
  const updateProjectName = useProjectStore((s) => s.updateProjectName)
  const updateEnvelopeExponent = useProjectStore((s) => s.updateEnvelopeExponent)
  const updateLightnessDistribution = useProjectStore((s) => s.updateLightnessDistribution)
  const envelopeExponent = useProjectStore((s) => s.activeProject?.envelopeExponent ?? 0.75)
  const lightnessDistribution = useProjectStore((s) => s.activeProject?.lightnessDistribution ?? 'linear')

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const prevName = useRef('')

  const [showAdder, setShowAdder] = useState(false)
  const [adderValue, setAdderValue] = useState('')
  const adderRef = useRef<HTMLInputElement>(null)

  const [localExponent, setLocalExponent] = useState(envelopeExponent)
  const exponentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDraggingRef = useRef(false)

  useEffect(() => {
    if (!isDraggingRef.current) setLocalExponent(envelopeExponent)
  }, [envelopeExponent])

  if (!activeProject) return null

  const palettes = activeProject.palettes
  const atLimit = palettes.length >= PALETTE_LIMIT

  function commitAdd(hex: string) {
    const result = sanitizeHex(hex)
    if (!result) { toast.error('Enter a valid hex color.'); return }
    if (result.alphaStripped) toast.info('Alpha value removed. Kulay works with solid colors only.')
    const err = validateBasePosition(result.hex, activeProject!.stepCount, activeProject!.lightnessRange)
    if (err === 'too-light') { toast.error('Color is too light for this scale.'); return }
    if (err === 'too-dark')  { toast.error('Color is too dark for this scale.'); return }
    const palette = generatePalette(
      result.hex,
      activeProject!.stepCount,
      activeProject!.backgrounds,
      activeProject!.palettes,
      activeProject!.lightnessRange,
      {
        envelopeExponent: activeProject!.envelopeExponent,
        lightnessDistribution: activeProject!.lightnessDistribution,
      },
    )
    addPalette(palette)
    onSelectPalette(palette.id)
    setShowAdder(false)
    setAdderValue('')
  }

  function handleRandom() {
    if (atLimit) return
    const hex = generateRandomHex(activeProject!.stepCount, activeProject!.lightnessRange)
    if (!hex) { toast.error('Could not generate a valid random color. Try again.'); return }
    commitAdd(hex)
  }

  function openAdder() {
    if (atLimit) return
    setAdderValue('')
    setShowAdder(true)
    setTimeout(() => adderRef.current?.focus(), 0)
  }

  function closeAdder() {
    setShowAdder(false)
    setAdderValue('')
  }

  function handleDelete(e: React.MouseEvent, paletteId: string, paletteName: string) {
    e.stopPropagation()
    if (selectedPaletteId === paletteId) onSelectPalette(null)
    deletePalette(paletteId)
    const toastId = toast(`${paletteName} deleted.`, {
      duration: 10_000,
      action: { label: 'Undo', onClick: () => { undoDeletePalette(); toast.dismiss(toastId) } },
    })
  }

  function handleExponentChange(value: number) {
    isDraggingRef.current = true
    setLocalExponent(value)
    if (exponentDebounceRef.current) clearTimeout(exponentDebounceRef.current)
    exponentDebounceRef.current = setTimeout(() => {
      isDraggingRef.current = false
      updateEnvelopeExponent(value)
    }, 150)
  }

  function startEditName() {
    prevName.current = projectName
    setNameValue(projectName)
    setEditingName(true)
  }

  function commitName() {
    const trimmed = nameValue.trim()
    if (!trimmed) setNameValue(prevName.current)
    else updateProjectName(trimmed.slice(0, 64))
    setEditingName(false)
  }

  return (
    <div className="w-[240px] flex-shrink-0 flex flex-col border-r border-bd-base dark:border-bd-base-dark bg-surface-sunken dark:bg-surface-sunken-dark overflow-hidden">

      {/* ── Nav ── */}
      <div className="flex flex-col gap-2 p-3 border-b border-bd-base dark:border-bd-base-dark flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark transition-colors w-fit"
        >
          ← Library
        </button>

        {editingName ? (
          <input
            autoFocus
            value={nameValue}
            maxLength={64}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') { setNameValue(prevName.current); setEditingName(false) }
            }}
            className="text-[13px] font-semibold text-fg-base dark:text-fg-base-dark bg-transparent border-b border-bd-strong dark:border-bd-strong-dark outline-none w-full"
          />
        ) : (
          <button
            onClick={startEditName}
            className="text-[13px] font-semibold text-fg-base dark:text-fg-base-dark hover:text-fg-muted dark:hover:text-fg-subtle-dark transition-colors text-left truncate w-full"
            title="Click to rename"
          >
            {projectName}
          </button>
        )}
      </div>

      {/* ── Colors ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-bd-base dark:border-bd-base-dark flex-shrink-0">
          <span className="text-[11px] font-medium text-fg-muted dark:text-fg-muted-dark">Colors</span>
          <button
            onClick={openAdder}
            disabled={atLimit}
            title={atLimit ? `Maximum of ${PALETTE_LIMIT} palettes reached` : 'Add color'}
            aria-label="Add color"
            className="w-6 h-6 flex items-center justify-center rounded text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark hover:bg-surface-neutral-subtle-active dark:hover:bg-surface-neutral-subtle-active-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <IconPlus size={13} stroke={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">

          {/* All colors — deselects and shows the full grid */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectPalette(null)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectPalette(null) }}
            className={`flex items-center px-3 py-2 cursor-pointer transition-colors ${
              selectedPaletteId === null
                ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark/80'
                : 'hover:bg-surface-neutral-subtle-active/60 dark:hover:bg-surface-neutral-subtle-active-dark/40'
            }`}
          >
            <span className={`text-[12px] leading-none ${
              selectedPaletteId === null
                ? 'text-fg-base dark:text-fg-base-dark font-medium'
                : 'text-fg-muted dark:text-fg-muted-dark'
            }`}>
              All colors
            </span>
          </div>

          {/* Inline hex adder */}
          {showAdder && (
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-1 rounded-md border border-bd-strong dark:border-bd-strong-dark bg-surface-base dark:bg-surface-base-dark px-2 h-8">
                <span className="text-[11px] text-fg-placeholder dark:text-fg-placeholder-dark select-none">#</span>
                <input
                  ref={adderRef}
                  type="text"
                  placeholder="e.g. 3B82F6"
                  maxLength={8}
                  spellCheck={false}
                  value={adderValue}
                  onChange={(e) => setAdderValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitAdd(adderValue)
                    if (e.key === 'Escape') closeAdder()
                  }}
                  className="flex-1 min-w-0 text-[11px] font-mono text-fg-base dark:text-fg-base-dark bg-transparent outline-none placeholder:text-fg-placeholder dark:placeholder:text-fg-placeholder-dark"
                />
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleRandom() }}
                  className="text-[10px] text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark transition-colors flex-shrink-0"
                >
                  Random
                </button>
              </div>
            </div>
          )}

          {palettes.length === 0 && !showAdder && (
            <p className="text-[11px] text-fg-placeholder dark:text-fg-placeholder-dark px-3 py-2">
              No colors yet.
            </p>
          )}

          {palettes.map((palette) => {
            const steps = getActiveSteps(palette)
            const isSelected = palette.id === selectedPaletteId
            return (
              <div
                key={palette.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectPalette(palette.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelectPalette(palette.id) }}
                className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark/80'
                    : 'hover:bg-surface-neutral-subtle-active/60 dark:hover:bg-surface-neutral-subtle-active-dark/40'
                }`}
              >
                <span className={`flex-1 min-w-0 truncate text-[12px] leading-none ${
                  isSelected
                    ? 'text-fg-base dark:text-fg-base-dark font-medium'
                    : 'text-fg-subtle dark:text-fg-subtle-dark'
                }`}>
                  {palette.name}
                </span>

                <div className="flex items-center gap-[2px] flex-shrink-0">
                  {steps.map((step) => (
                    <div
                      key={step.label}
                      className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                      style={{ backgroundColor: step.hex }}
                    />
                  ))}
                </div>

                <div className="w-0 overflow-hidden group-hover:w-6 transition-[width] duration-150 ease-in flex-shrink-0">
                  <button
                    onClick={(e) => handleDelete(e, palette.id, palette.name)}
                    title="Delete palette"
                    className="w-6 h-6 flex items-center justify-center rounded text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-danger dark:hover:text-fg-danger-dark hover:bg-surface-danger-subtle-rest dark:hover:bg-surface-danger-subtle-rest-dark transition-colors"
                  >
                    <IconTrash size={12} stroke={1.75} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Generation ── */}
      <div className="flex flex-col gap-2.5 px-3 py-2.5 border-t border-bd-base dark:border-bd-base-dark flex-shrink-0">
        <span className="text-[10px] font-medium text-fg-muted dark:text-fg-muted-dark uppercase tracking-wide select-none">Generation</span>

        {/* Envelope exponent slider */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">Expressive</span>
            <span className="text-[10px] tabular-nums text-fg-muted dark:text-fg-muted-dark">{localExponent.toFixed(2)}</span>
            <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">Even</span>
          </div>
          <input
            type="range"
            min={40} max={140} step={5}
            value={Math.round(localExponent * 100)}
            onChange={(e) => handleExponentChange(Number(e.target.value) / 100)}
            aria-label="Envelope exponent"
            className="w-full accent-neutral-700 dark:accent-neutral-300"
          />
        </div>

        {/* Lightness distribution toggle */}
        <div className="flex items-center rounded-md border border-bd-base dark:border-bd-base-dark overflow-hidden">
          {(['linear', 'perceptual'] as const).map((val) => (
            <button
              key={val}
              onClick={() => updateLightnessDistribution(val)}
              className={`flex-1 py-1 text-[10px] capitalize transition-colors ${
                lightnessDistribution === val
                  ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark text-fg-base dark:text-fg-base-dark font-medium'
                  : 'text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
