import { useState } from 'react'
import { toast } from 'sonner'
import type { CurveType, Palette } from '../../types/project'
import { useProjectStore } from '../../store/useProjectStore'

const TYPES: Array<{ value: CurveType; label: string }> = [
  { value: 'lightness', label: 'Lightness' },
  { value: 'chroma', label: 'Chroma' },
  { value: 'hue', label: 'Hue' },
]

interface ApplyTarget {
  kind: 'curve' | 'set'
  id: string
  name: string
}

export function CurveLibrary({
  palette,
  selectedCurveId,
  onSelectCurve,
}: {
  palette: Palette
  selectedCurveId?: string | null
  onSelectCurve?: (curveId: string) => void
}) {
  const palettes = useProjectStore((state) => state.activeProject?.palettes ?? [])
  const savedCurves = useProjectStore((state) => state.activeProject?.savedCurves ?? [])
  const curveSets = useProjectStore((state) => state.activeProject?.curveSets ?? [])
  const saveCurve = useProjectStore((state) => state.saveCurve)
  const saveCurveSet = useProjectStore((state) => state.saveCurveSet)
  const applySavedCurve = useProjectStore((state) => state.applySavedCurve)
  const applyCurveSet = useProjectStore((state) => state.applyCurveSet)
  const [composer, setComposer] = useState<'curve' | 'set' | null>(null)
  const [applyTarget, setApplyTarget] = useState<ApplyTarget | null>(null)
  const [selectedPaletteIds, setSelectedPaletteIds] = useState<string[]>([])
  const [curveType, setCurveType] = useState<CurveType>('lightness')
  const [name, setName] = useState('')
  const setCurveIds = new Set(curveSets.flatMap((curveSet) => Object.values(curveSet.curveIds)))
  const individualCurves = savedCurves.filter((curve) => !setCurveIds.has(curve.id))
  const curvesByType = Object.fromEntries(TYPES.map((type) => [
    type.value,
    individualCurves.filter((curve) => curve.type === type.value),
  ])) as Record<CurveType, typeof individualCurves>

  function openComposer(next: 'curve' | 'set') {
    setApplyTarget(null)
    setComposer(next)
    setName('')
  }

  function openApply(next: ApplyTarget) {
    setComposer(null)
    setApplyTarget(next)
    setSelectedPaletteIds([palette.id])
  }

  function togglePalette(paletteId: string) {
    setSelectedPaletteIds((current) => current.includes(paletteId)
      ? current.filter((id) => id !== paletteId)
      : [...current, paletteId])
  }

  function commitApply() {
    if (!applyTarget || selectedPaletteIds.length === 0) return
    if (applyTarget.kind === 'curve') applySavedCurve(selectedPaletteIds, applyTarget.id)
    else applyCurveSet(selectedPaletteIds, applyTarget.id)
    const count = selectedPaletteIds.length
    toast.success(`${applyTarget.name} applied and linked to ${count} ${count === 1 ? 'color' : 'colors'}.`)
    setApplyTarget(null)
  }

  function commitSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    const id = composer === 'curve'
      ? saveCurve(palette.id, curveType, trimmed)
      : saveCurveSet(palette.id, trimmed)
    if (!id) return
    toast.success(composer === 'curve' ? 'Curve saved and linked.' : 'Curve set saved and linked.')
    if (composer === 'curve') onSelectCurve?.(id)
    setComposer(null)
    setName('')
  }

  return (
    <section className="mt-1 border-t border-bd-base dark:border-bd-base-dark">
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <span className="flex-1 text-[11px] font-medium text-fg-muted dark:text-fg-muted-dark">Curves</span>
        <button
          type="button"
          onClick={() => openComposer('curve')}
          className="px-2 py-1 rounded-md border border-bd-base dark:border-bd-base-dark text-[10px] text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark transition-colors"
        >
          Save curve
        </button>
        <button
          type="button"
          onClick={() => openComposer('set')}
          className="px-2 py-1 rounded-md border border-bd-base dark:border-bd-base-dark text-[10px] text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark transition-colors"
        >
          Save set
        </button>
      </div>

      {composer && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {composer === 'curve' && (
            <div className="grid grid-cols-3 rounded-md border border-bd-base dark:border-bd-base-dark overflow-hidden">
              {TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setCurveType(type.value)}
                  className={`h-7 text-[10px] transition-colors ${curveType === type.value
                    ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark text-fg-base dark:text-fg-base-dark'
                    : 'text-fg-placeholder dark:text-fg-placeholder-dark'}`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="text"
              value={name}
              maxLength={48}
              placeholder={composer === 'curve' ? `${TYPES.find((type) => type.value === curveType)!.label} curve name` : 'Curve set name'}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitSave()
                if (event.key === 'Escape') setComposer(null)
              }}
              className="flex-1 min-w-0 h-8 px-2 rounded-md border border-bd-base dark:border-bd-base-dark bg-surface-control dark:bg-surface-control-dark text-[11px] text-fg-base dark:text-fg-base-dark outline-none focus:border-bd-strong dark:focus:border-bd-strong-dark"
            />
            <button
              type="button"
              disabled={!name.trim()}
              onClick={commitSave}
              className="h-8 px-2.5 rounded-md bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-[10px] font-medium text-fg-inverted dark:text-fg-inverted-dark disabled:opacity-30"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {applyTarget && (
        <div className="flex flex-col gap-2 border-t border-bd-base px-3 py-3 dark:border-bd-base-dark">
          <div>
            <p className="truncate text-[11px] font-medium text-fg-base dark:text-fg-base-dark">Apply {applyTarget.name}</p>
            <p className="mt-0.5 text-[9px] text-fg-placeholder dark:text-fg-placeholder-dark">Choose every color that should stay linked.</p>
          </div>
          <div className="max-h-44 overflow-y-auto rounded-md border border-bd-base dark:border-bd-base-dark">
            {palettes.map((candidate) => {
              const selected = selectedPaletteIds.includes(candidate.id)
              return (
                <label
                  key={candidate.id}
                  className="flex min-h-8 cursor-pointer items-center gap-2 border-b border-bd-base px-2 last:border-b-0 hover:bg-surface-neutral-subtle-hover dark:border-bd-base-dark dark:hover:bg-surface-neutral-subtle-hover-dark"
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => togglePalette(candidate.id)}
                    className="h-3.5 w-3.5 accent-current"
                  />
                  <span className="h-3 w-3 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: candidate.baseHex }} />
                  <span className="min-w-0 flex-1 truncate text-[10px] text-fg-subtle dark:text-fg-subtle-dark">{candidate.name}</span>
                  {candidate.id === palette.id && (
                    <span className="text-[8px] uppercase tracking-wide text-fg-placeholder dark:text-fg-placeholder-dark">Current</span>
                  )}
                </label>
              )
            })}
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setApplyTarget(null)}
              className="h-7 px-2 text-[10px] text-fg-muted hover:text-fg-base dark:text-fg-muted-dark dark:hover:text-fg-base-dark"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedPaletteIds.length === 0}
              onClick={commitApply}
              className="h-7 rounded-md bg-surface-neutral-strong-rest px-2.5 text-[10px] font-medium text-fg-inverted disabled:opacity-30 dark:bg-surface-neutral-strong-rest-dark dark:text-fg-inverted-dark"
            >
              Apply to {selectedPaletteIds.length}
            </button>
          </div>
        </div>
      )}

      {(savedCurves.length > 0 || curveSets.length > 0) && (
        <div className="flex flex-col gap-3 px-3 pb-3">
          {curveSets.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wide text-fg-placeholder dark:text-fg-placeholder-dark">Curve sets</span>
              {curveSets.map((curveSet) => {
                const linked = TYPES.every((type) => palette.curveBindings?.[type.value] === curveSet.curveIds[type.value])
                return (
                  <div key={curveSet.id} className="rounded-md border border-bd-base dark:border-bd-base-dark overflow-hidden">
                    <div className="flex min-h-8 items-center gap-2 px-2">
                      <span className="min-w-0 flex-1 truncate text-[11px] text-fg-subtle dark:text-fg-subtle-dark">{curveSet.name}</span>
                      {linked && <span className="text-[9px] text-fg-placeholder dark:text-fg-placeholder-dark">Linked</span>}
                      <button
                        type="button"
                        onClick={() => openApply({ kind: 'set', id: curveSet.id, name: curveSet.name })}
                        className="px-1 py-1 text-[10px] text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark"
                      >
                        Apply
                      </button>
                    </div>
                    <div className="grid grid-cols-3 border-t border-bd-base dark:border-bd-base-dark">
                      {TYPES.map((type) => {
                        const curveId = curveSet.curveIds[type.value]
                        return (
                          <button
                            key={type.value}
                            type="button"
                            aria-pressed={selectedCurveId === curveId}
                            onClick={() => onSelectCurve?.(curveId)}
                            className={`h-7 border-r border-bd-base text-[9px] last:border-r-0 dark:border-bd-base-dark ${selectedCurveId === curveId
                              ? 'bg-surface-neutral-subtle-active text-fg-base dark:bg-surface-neutral-subtle-active-dark dark:text-fg-base-dark'
                              : 'text-fg-placeholder hover:text-fg-subtle dark:text-fg-placeholder-dark dark:hover:text-fg-subtle-dark'}`}
                          >
                            {type.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {TYPES.map((type) => curvesByType[type.value].length > 0 && (
            <div key={type.value} className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wide text-fg-placeholder dark:text-fg-placeholder-dark">{type.label}</span>
              {curvesByType[type.value].map((curve) => {
                  const linked = palette.curveBindings?.[curve.type] === curve.id
                  return (
                    <div key={curve.id} className="flex items-center gap-2 min-h-7">
                      <button
                        type="button"
                        aria-pressed={selectedCurveId === curve.id}
                        onClick={() => onSelectCurve?.(curve.id)}
                        className={`min-w-0 flex-1 truncate text-left text-[11px] ${selectedCurveId === curve.id
                          ? 'font-medium text-fg-base dark:text-fg-base-dark'
                          : 'text-fg-subtle dark:text-fg-subtle-dark'}`}
                      >
                        {curve.name}
                      </button>
                      {linked && <span className="text-[9px] text-fg-placeholder dark:text-fg-placeholder-dark">Linked</span>}
                      <button
                        type="button"
                        onClick={() => openApply({ kind: 'curve', id: curve.id, name: curve.name })}
                        className="px-2 py-1 text-[10px] text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark"
                      >
                        Apply
                      </button>
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
