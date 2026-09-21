import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { SavedCurve } from '../../types/project'
import type { RealizedCurvePreview } from '../../lib/savedCurves'
import { constrainSavedCurvePointValue } from '../../lib/savedCurves'
import { curveColumnCenter, savedCurvePointX } from '../../lib/curveChart'
import { HUE_OFFSET_RANGE, hueCurveValueToDegrees } from '../../lib/curveEngine'
import { getActiveSteps } from '../../types/project'

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 600

function displayValue(curve: SavedCurve, value: number): string {
  if (curve.type === 'lightness') return `L ${value.toFixed(3)}`
  if (curve.type === 'chroma') return `${Math.round(value * 100)}% gamut`
  const degrees = hueCurveValueToDegrees(value)
  return `ΔH ${degrees >= 0 ? '+' : ''}${degrees.toFixed(1)}°`
}

export function IsolatedCurveEditor({
  curve,
  preview,
  selectedPointId,
  onSelectPoint,
  onPreviewPoint,
  onCommitPreview,
  onCancelPreview,
}: {
  curve: SavedCurve
  preview: RealizedCurvePreview | null
  selectedPointId: string | null
  onSelectPoint: (pointId: string) => void
  onPreviewPoint: (pointId: string, value: number) => void
  onCommitPreview: () => void
  onCancelPreview: () => void
}) {
  const chartRef = useRef<SVGSVGElement>(null)
  const curveRef = useRef(curve)
  const previewPointRef = useRef(onPreviewPoint)
  const commitPreviewRef = useRef(onCommitPreview)
  const cancelPreviewRef = useRef(onCancelPreview)
  const pendingValueRef = useRef<number | null>(null)
  const activeDragRef = useRef<{ pointerId: number; pointId: string } | null>(null)
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null)
  const [drag, setDrag] = useState<{ pointerId: number; pointId: string } | null>(null)
  const referenceSteps = preview ? getActiveSteps(preview.palette) : []
  const darkMode = preview?.palette.activeMode === 'dark'
  const points = [...curve.points].sort((a, b) => a.position - b.position)

  curveRef.current = curve
  previewPointRef.current = onPreviewPoint
  commitPreviewRef.current = onCommitPreview
  cancelPreviewRef.current = onCancelPreview

  const plotted = points.map((point) => ({
    ...point,
    x: savedCurvePointX(point.position, referenceSteps.length || points.length, VIEW_WIDTH, darkMode),
    y: (1 - point.value) * VIEW_HEIGHT,
  }))
  const realized = (preview?.samples ?? []).map((sample, index, samples) => ({
    ...sample,
    x: curveColumnCenter(index, samples.length, VIEW_WIDTH),
    y: (1 - sample.realizedValue) * VIEW_HEIGHT,
  }))
  const hovered = hoveredPointId ? plotted.find((point) => point.id === hoveredPointId) ?? null : null
  const appliedAtHover = hovered
    ? realized.reduce<typeof realized[number] | null>((nearest, sample) => !nearest || Math.abs(sample.semanticPosition - hovered.position) < Math.abs(nearest.semanticPosition - hovered.position) ? sample : nearest, null)
    : null

  function beginDrag(event: ReactPointerEvent<SVGCircleElement>, pointId: string) {
    event.preventDefault()
    onSelectPoint(pointId)
    const activeDrag = { pointerId: event.pointerId, pointId }
    activeDragRef.current = activeDrag
    pendingValueRef.current = curveRef.current.points.find((point) => point.id === pointId)?.value ?? null
    setDrag(activeDrag)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function valueFromPointer(event: ReactPointerEvent<SVGCircleElement>): number | null {
    const activeDrag = activeDragRef.current
    if (!activeDrag || event.pointerId !== activeDrag.pointerId || !chartRef.current) return null
    const bounds = chartRef.current.getBoundingClientRect()
    const requested = 1 - (event.clientY - bounds.top) / bounds.height
    return constrainSavedCurvePointValue(curveRef.current, activeDrag.pointId, requested)
  }

  function moveDrag(event: ReactPointerEvent<SVGCircleElement>) {
    const activeDrag = activeDragRef.current
    const value = valueFromPointer(event)
    if (!activeDrag || value === null) return
    pendingValueRef.current = value
    previewPointRef.current(activeDrag.pointId, value)
  }

  function finishDrag(event: ReactPointerEvent<SVGCircleElement>, cancelled = false) {
    const activeDrag = activeDragRef.current
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return
    if (cancelled) {
      cancelPreviewRef.current()
    } else {
      const value = valueFromPointer(event) ?? pendingValueRef.current
      if (value !== null) previewPointRef.current(activeDrag.pointId, value)
      commitPreviewRef.current()
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    activeDragRef.current = null
    pendingValueRef.current = null
    setDrag(null)
  }

  return (
    <main className="relative flex-1 min-w-0 overflow-hidden bg-surface-page dark:bg-surface-page-dark">
      <svg ref={chartRef} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} preserveAspectRatio="none" className="absolute inset-0 block h-full w-full touch-none select-none" role="img" aria-label={`Editing saved ${curve.type} curve ${curve.name}`}>
        {referenceSteps.length > 0 ? referenceSteps.map((step, index) => (
          <rect key={step.id} x={(index / referenceSteps.length) * VIEW_WIDTH} y={0} width={VIEW_WIDTH / referenceSteps.length + 0.5} height={VIEW_HEIGHT} fill={step.hex} />
        )) : <rect width={VIEW_WIDTH} height={VIEW_HEIGHT} fill="currentColor" opacity={0.08} />}

        {realized.length > 1 && (
          <>
            <polyline points={realized.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth={4} strokeDasharray="5 6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            <polyline points={realized.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} strokeDasharray="5 6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </>
        )}
        <polyline points={plotted.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="rgba(0,0,0,0.78)" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <polyline points={plotted.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke="rgba(255,255,255,0.96)" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {plotted.map((point, index) => {
          const active = hoveredPointId === point.id || selectedPointId === point.id || drag?.pointId === point.id
          const pointerHandlers = {
            onPointerDown: (event: ReactPointerEvent<SVGCircleElement>) => beginDrag(event, point.id),
            onPointerMove: moveDrag,
            onPointerUp: finishDrag,
            onPointerCancel: (event: ReactPointerEvent<SVGCircleElement>) => finishDrag(event, true),
            onPointerEnter: () => setHoveredPointId(point.id),
            onPointerLeave: () => { if (!drag) setHoveredPointId(null) },
          }
          return (
            <g key={point.id}>
              <circle cx={point.x} cy={point.y} r={20} fill="transparent" className="cursor-ns-resize" {...pointerHandlers} />
              <circle
                cx={point.x} cy={point.y} r={active ? 7 : 3.5} fill="rgba(255,255,255,0.98)" stroke="rgba(0,0,0,0.8)" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
                role="button" tabIndex={0} aria-label={`Curve point ${index + 1}, ${displayValue(curve, point.value)}`} aria-pressed={selectedPointId === point.id}
                className="cursor-ns-resize outline-none" style={{ transition: 'r 140ms ease-out' }} {...pointerHandlers}
                onFocus={() => { setHoveredPointId(point.id); onSelectPoint(point.id) }} onBlur={() => setHoveredPointId(null)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault()
                    const increment = curve.type === 'hue' ? 1 / HUE_OFFSET_RANGE : 0.01
                    onPreviewPoint(point.id, constrainSavedCurvePointValue(curve, point.id, point.value + increment * (event.key === 'ArrowUp' ? 1 : -1)))
                    onCommitPreview()
                  }
                }}
              />
            </g>
          )
        })}
      </svg>

      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-white/20 bg-black/55 px-3 py-2 text-white shadow-sm backdrop-blur-sm">
        <span className="text-[11px] font-medium">{curve.name}</span>
        <span className="text-[9px] capitalize text-white/55">{curve.type}</span>
        {preview && <span className="text-[9px] text-white/55">Preview: {preview.palette.name}</span>}
      </div>

      {hovered && (
        <div role="tooltip" className="absolute z-20 rounded-md border border-white/20 bg-black/75 px-2.5 py-2 text-[11px] tabular-nums text-white shadow-lg backdrop-blur-sm pointer-events-none" style={{ left: `min(calc(100% - 170px), max(8px, ${(hovered.x / VIEW_WIDTH) * 100}%))`, top: `max(8px, calc(${(1 - hovered.value) * 100}% - 58px))` }}>
          <div className="text-white/60">Curve · {Math.round(hovered.position * 100)}%</div>
          <div>{displayValue(curve, hovered.value)}</div>
          {appliedAtHover && Math.abs(appliedAtHover.realizedValue - hovered.value) > 0.001 && <div className="text-white/55">Applied {displayValue(curve, appliedAtHover.realizedValue)}</div>}
        </div>
      )}
    </main>
  )
}
