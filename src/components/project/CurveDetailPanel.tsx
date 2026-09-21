import { useEffect, useState } from 'react'
import { IconArrowBackUp, IconArrowForwardUp, IconChevronRight, IconLinkOff } from '@tabler/icons-react'
import type { CurveConstraintStrategy, CurveShapePreset, Palette, SavedCurve, SavedCurvePoint } from '../../types/project'
import type { RealizedCurveSample } from '../../lib/savedCurves'
import { curveShapePresets } from '../../lib/savedCurves'
import { parseCurveInputValue } from '../../lib/curveChart'
import { hueCurveValueToDegrees, hueDegreesToCurveValue } from '../../lib/curveEngine'

const PRESET_LABELS: Record<CurveShapePreset, string> = {
  linear: 'Linear',
  'ease-in': 'Ease in',
  'ease-out': 'Ease out',
  'ease-in-out': 'Ease in-out',
  smoothstep: 'Smoothstep',
  bell: 'Bell',
  'early-peak': 'Early peak',
  'late-peak': 'Late peak',
  'soft-ends': 'Soft ends',
}

function inputValue(curve: SavedCurve, value: number): number {
  if (curve.type === 'chroma') return value * 100
  if (curve.type === 'hue') return hueCurveValueToDegrees(value)
  return value
}

function storedValue(curve: SavedCurve, value: number): number {
  if (curve.type === 'chroma') return value / 100
  if (curve.type === 'hue') return hueDegreesToCurveValue(value)
  return value
}

function valueSuffix(curve: SavedCurve): string {
  if (curve.type === 'chroma') return '%'
  if (curve.type === 'hue') return '°'
  return 'L'
}

function PointValueInput({ curve, point, disabled, onCommit }: {
  curve: SavedCurve
  point: SavedCurvePoint
  disabled?: boolean
  onCommit: (value: number) => void
}) {
  const value = inputValue(curve, point.value)
  const decimals = curve.type === 'lightness' ? 3 : 1
  const [draft, setDraft] = useState(value.toFixed(decimals))

  useEffect(() => setDraft(value.toFixed(decimals)), [decimals, value])

  function commit() {
    const parsed = parseCurveInputValue(draft)
    if (parsed !== null) onCommit(storedValue(curve, parsed))
    else setDraft(value.toFixed(decimals))
  }

  return (
    <div className="flex items-center gap-1 rounded-md border border-bd-base bg-surface-control px-1.5 dark:border-bd-base-dark dark:bg-surface-control-dark">
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        aria-label={`Curve point at ${Math.round(point.position * 100)}% value`}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
          if (event.key === 'Escape') {
            setDraft(value.toFixed(decimals))
            event.currentTarget.blur()
          }
        }}
        className="w-14 bg-transparent py-1 text-right text-[10px] tabular-nums text-fg-base outline-none disabled:opacity-45 dark:text-fg-base-dark"
      />
      <span className="text-[9px] text-fg-placeholder dark:text-fg-placeholder-dark">{valueSuffix(curve)}</span>
    </div>
  )
}

export function CurveDetailPanel({
  curve,
  samples,
  palettes,
  selectedPointId,
  onSelectPoint,
  onUpdatePoint,
  onUpdateStrategy,
  onPreviewPreset,
  previewing,
  onCommitPreview,
  onCancelPreview,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDetach,
  onClose,
}: {
  curve: SavedCurve
  samples: RealizedCurveSample[]
  palettes: Palette[]
  selectedPointId: string | null
  onSelectPoint: (pointId: string) => void
  onUpdatePoint: (pointId: string, value: number) => void
  onUpdateStrategy: (strategy: CurveConstraintStrategy) => void
  onPreviewPreset: (preset: CurveShapePreset) => void
  previewing: boolean
  onCommitPreview: () => void
  onCancelPreview: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  onDetach: (paletteId: string) => void
  onClose: () => void
}) {
  const linkedPalettes = palettes.filter((palette) => palette.curveBindings?.[curve.type] === curve.id)
  const presets = curveShapePresets(curve.type)
  const darkPreview = samples.length > 1 && samples[0]!.semanticPosition > samples[samples.length - 1]!.semanticPosition
  const points = [...curve.points].sort((a, b) => darkPreview ? b.position - a.position : a.position - b.position)

  return (
    <aside className="w-[300px] flex-shrink-0 overflow-y-auto border-l border-bd-base bg-surface-sunken dark:border-bd-base-dark dark:bg-surface-sunken-dark">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-bd-base bg-surface-sunken px-3 py-2.5 dark:border-bd-base-dark dark:bg-surface-sunken-dark">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-fg-base dark:text-fg-base-dark">{curve.name}</span>
          <span className="block text-[9px] capitalize text-fg-placeholder dark:text-fg-placeholder-dark">{curve.type} curve</span>
        </span>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo curve edit"
          aria-label="Undo curve edit"
          className="flex h-7 w-7 items-center justify-center rounded text-fg-placeholder hover:bg-surface-neutral-subtle-active hover:text-fg-subtle disabled:opacity-25 dark:text-fg-placeholder-dark dark:hover:bg-surface-neutral-subtle-active-dark dark:hover:text-fg-subtle-dark"
        >
          <IconArrowBackUp size={14} stroke={1.75} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo curve edit"
          aria-label="Redo curve edit"
          className="flex h-7 w-7 items-center justify-center rounded text-fg-placeholder hover:bg-surface-neutral-subtle-active hover:text-fg-subtle disabled:opacity-25 dark:text-fg-placeholder-dark dark:hover:bg-surface-neutral-subtle-active-dark dark:hover:text-fg-subtle-dark"
        >
          <IconArrowForwardUp size={14} stroke={1.75} />
        </button>
        <button
          type="button"
          onClick={onClose}
          title="Collapse inspector"
          aria-label="Collapse inspector"
          className="flex h-7 w-7 items-center justify-center rounded text-fg-placeholder hover:bg-surface-neutral-subtle-active hover:text-fg-subtle dark:text-fg-placeholder-dark dark:hover:bg-surface-neutral-subtle-active-dark dark:hover:text-fg-subtle-dark"
        >
          <IconChevronRight size={14} stroke={1.75} />
        </button>
      </div>

      <section className="border-b border-bd-base px-3 py-3 dark:border-bd-base-dark">
        <div className="mb-3 flex items-center justify-between gap-3">
          <label htmlFor={`curve-strategy-${curve.id}`} className="text-[9px] uppercase tracking-wide text-fg-placeholder dark:text-fg-placeholder-dark">Constraint</label>
          <select
            id={`curve-strategy-${curve.id}`}
            value={curve.strategy ?? 'anchored'}
            onChange={(event) => onUpdateStrategy(event.target.value as CurveConstraintStrategy)}
            className="h-7 rounded-md border border-bd-base bg-surface-control px-2 text-[10px] text-fg-base dark:border-bd-base-dark dark:bg-surface-control-dark dark:text-fg-base-dark"
          >
            <option value="free">Free</option>
            <option value="monotonic">Monotonic</option>
            <option value="smooth">Smooth</option>
            <option value="anchored">Anchored</option>
          </select>
        </div>
        <h3 className="mb-2 text-[9px] uppercase tracking-wide text-fg-placeholder dark:text-fg-placeholder-dark">Shape presets</h3>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onPreviewPreset(preset)}
              className="rounded-md border border-bd-base px-2 py-1.5 text-[10px] text-fg-muted hover:border-bd-strong hover:text-fg-base dark:border-bd-base-dark dark:text-fg-muted-dark dark:hover:border-bd-strong-dark dark:hover:text-fg-base-dark"
            >
              {PRESET_LABELS[preset]}
            </button>
          ))}
        </div>
        {previewing && (
          <div className="mt-3 rounded-md border border-bd-strong bg-surface-neutral-subtle-rest p-2 dark:border-bd-strong-dark dark:bg-surface-neutral-subtle-rest-dark">
            <p className="text-[10px] text-fg-subtle dark:text-fg-subtle-dark">Previewing this shape on the curve and its linked colors.</p>
            <div className="mt-2 flex justify-end gap-1.5">
              <button
                type="button"
                onClick={onCancelPreview}
                className="h-7 px-2 text-[10px] text-fg-muted hover:text-fg-base dark:text-fg-muted-dark dark:hover:text-fg-base-dark"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onCommitPreview}
                className="h-7 rounded-md bg-surface-neutral-strong-rest px-2.5 text-[10px] font-medium text-fg-inverted dark:bg-surface-neutral-strong-rest-dark dark:text-fg-inverted-dark"
              >
                Apply preset
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="border-b border-bd-base py-3 dark:border-bd-base-dark">
        <h3 className="mb-2 px-3 text-[9px] uppercase tracking-wide text-fg-placeholder dark:text-fg-placeholder-dark">Point values</h3>
        <div>
          {points.map((point) => {
            const sample = samples.reduce<RealizedCurveSample | null>((nearest, candidate) => !nearest || Math.abs(candidate.semanticPosition - point.position) < Math.abs(nearest.semanticPosition - point.position) ? candidate : nearest, null)
            return (
            <div
              key={point.id}
              role="button"
              tabIndex={0}
              aria-pressed={selectedPointId === point.id}
              onClick={() => onSelectPoint(point.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') onSelectPoint(point.id)
              }}
              className={`flex items-center gap-2 px-3 py-1.5 ${selectedPointId === point.id
                ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark'
                : 'hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark'}`}
            >
              <span className="w-12 text-[9px] tabular-nums text-fg-placeholder dark:text-fg-placeholder-dark">{Math.round(point.position * 100)}%</span>
              <span className="min-w-0 flex-1 text-[10px] text-fg-subtle dark:text-fg-subtle-dark">
                {sample ? `Step ${sample.label}` : 'Control point'}
              </span>
              <div onClick={(event) => event.stopPropagation()}>
                <PointValueInput curve={curve} point={point} disabled={previewing} onCommit={(value) => onUpdatePoint(point.id, value)} />
              </div>
            </div>
          )})}
        </div>
      </section>

      <section className="px-3 py-3">
        <h3 className="mb-2 text-[9px] uppercase tracking-wide text-fg-placeholder dark:text-fg-placeholder-dark">Linked colors</h3>
        {linkedPalettes.length === 0 ? (
          <p className="text-[10px] leading-relaxed text-fg-placeholder dark:text-fg-placeholder-dark">This curve is not linked to a color.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {linkedPalettes.map((palette) => (
              <div key={palette.id} className="flex min-h-7 items-center gap-2">
                <span className="h-3 w-3 rounded-full border border-black/10" style={{ backgroundColor: palette.baseHex }} />
                <span className="min-w-0 flex-1 truncate text-[10px] text-fg-subtle dark:text-fg-subtle-dark">{palette.name}</span>
                <button
                  type="button"
                  onClick={() => onDetach(palette.id)}
                  title={`Detach ${palette.name}`}
                  aria-label={`Detach ${palette.name}`}
                  className="flex h-6 w-6 items-center justify-center rounded text-fg-placeholder hover:bg-surface-neutral-subtle-hover hover:text-fg-base dark:text-fg-placeholder-dark dark:hover:bg-surface-neutral-subtle-hover-dark dark:hover:text-fg-base-dark"
                >
                  <IconLinkOff size={12} stroke={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </aside>
  )
}
