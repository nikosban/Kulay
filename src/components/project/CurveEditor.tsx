import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { IconPlus } from '@tabler/icons-react'
import type { CurveConstraintStrategy, Palette } from '../../types/project'
import { getActiveSteps } from '../../types/project'
import { constrainCurveStepValue, curveDisplayValue, curvePlotValue, isCurveChannelEditable, type CurveChannel } from '../../lib/curveChart'
import { curveSemanticPosition, sampleCurveCorrection } from '../../lib/savedCurves'
import { editCurveIntent, HUE_OFFSET_RANGE, renderCurveValues } from '../../lib/curveEngine'

const VIEW_WIDTH = 1000
const VIEW_HEIGHT = 600
const MAX_PALETTE_STEPS = 20

const CHANNELS: Array<{ key: CurveChannel; label: string }> = [
  { key: 'lightness', label: 'Lightness' },
  { key: 'chroma', label: 'Chroma' },
  { key: 'hue', label: 'Hue' },
]

interface Props {
  palette: Palette
  onUpdateCurveStep: (paletteId: string, stepLabel: number, channel: CurveChannel, value: number) => void
  onUpdateCurveStrategy: (paletteId: string, channel: CurveChannel, strategy: CurveConstraintStrategy) => void
  onSelectStep: (stepLabel: number) => void
  onInsertStep?: (leftLabel: number | null, rightLabel: number | null) => void
}

interface HoverState {
  channel: CurveChannel
  index: number
  left: number
  top: number
}

interface DragState {
  pointerId: number
  channel: CurveChannel
  stepId: string
}

interface DragVisual {
  channel: CurveChannel
  stepId: string
  plotValue: number
}

export function CurveEditor({ palette, onUpdateCurveStep, onUpdateCurveStrategy, onSelectStep, onInsertStep }: Props) {
  const chartRef = useRef<SVGSVGElement>(null)
  const paletteRef = useRef(palette)
  const onUpdateCurveStepRef = useRef(onUpdateCurveStep)
  const pendingValueRef = useRef<number | null>(null)
  const activeDragRef = useRef<DragState | null>(null)
  const [visible, setVisible] = useState<Record<CurveChannel, boolean>>({ lightness: true, chroma: true, hue: true })
  const [hover, setHover] = useState<HoverState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null)

  paletteRef.current = palette
  onUpdateCurveStepRef.current = onUpdateCurveStep

  const steps = getActiveSteps(palette)
  const baseHue = steps.find((step) => step.isBase)?.oklch.h ?? steps[0]?.oklch.h ?? 0
  const columnWidth = VIEW_WIDTH / Math.max(1, steps.length)
  const canInsert = Boolean(onInsertStep) && steps.length < MAX_PALETTE_STEPS

  const displayedSteps = useMemo(() => {
    if (!dragVisual) return steps
    const stepIndex = steps.findIndex((step) => step.id === dragVisual.stepId)
    if (stepIndex < 0) return steps
    const strategy = palette.curveStrategies?.[dragVisual.channel] ?? 'free'
    const intents = editCurveIntent(steps, stepIndex, dragVisual.channel, dragVisual.plotValue, strategy)
    return steps.map((step, index) => {
      if (intents[index]![dragVisual.channel] === step.curveValues[dragVisual.channel]) return step
      const result = renderCurveValues(intents[index]!, baseHue)
      return { ...step, curveValues: intents[index]!, ...result }
    })
  }, [baseHue, dragVisual, palette.curveStrategies, steps])

  const paths = useMemo(() => CHANNELS.map((channel) => ({
    ...channel,
    points: displayedSteps.map((step, index) => {
      const value = curvePlotValue(step, baseHue, channel.key)
      return { x: columnWidth * (index + 0.5), y: (1 - Math.max(0, Math.min(1, value))) * VIEW_HEIGHT }
    }),
  })), [baseHue, columnWidth, displayedSteps])

  function beginDrag(event: ReactPointerEvent<SVGElement>, channel: CurveChannel, stepId: string) {
    event.preventDefault()
    const step = steps.find((candidate) => candidate.id === stepId)
    if (!step) return
    onSelectStep(step.label)
    setDragVisual({ channel, stepId, plotValue: curvePlotValue(step, baseHue, channel) })
    const activeDrag = { pointerId: event.pointerId, channel, stepId }
    activeDragRef.current = activeDrag
    setDrag(activeDrag)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: ReactPointerEvent<SVGElement>) {
    const activeDrag = activeDragRef.current
    if (!activeDrag || event.pointerId !== activeDrag.pointerId || !chartRef.current) return false
    const bounds = chartRef.current.getBoundingClientRect()
    const viewY = ((event.clientY - bounds.top) / bounds.height) * VIEW_HEIGHT
    const currentSteps = getActiveSteps(paletteRef.current)
    const stepIndex = currentSteps.findIndex((step) => step.id === activeDrag.stepId)
    const strategy = paletteRef.current.curveStrategies?.[activeDrag.channel] ?? 'free'
    const plotValue = constrainCurveStepValue(currentSteps, stepIndex, activeDrag.channel, 1 - viewY / VIEW_HEIGHT, strategy)
    pendingValueRef.current = plotValue
    setDragVisual({ channel: activeDrag.channel, stepId: activeDrag.stepId, plotValue })
    const index = getActiveSteps(paletteRef.current).findIndex((step) => step.id === activeDrag.stepId)
    if (index !== -1) {
      setHover({
        channel: activeDrag.channel,
        index,
        left: Math.min(bounds.width - 164, Math.max(8, event.clientX - bounds.left + 12)),
        top: Math.min(bounds.height - 112, Math.max(8, event.clientY - bounds.top - 54)),
      })
    }
    return true
  }

  function finishDrag(event: ReactPointerEvent<SVGElement>, cancelled = false) {
    const activeDrag = activeDragRef.current
    if (!activeDrag || event.pointerId !== activeDrag.pointerId) return
    const currentPalette = paletteRef.current
    const currentSteps = getActiveSteps(currentPalette)
    const stepIndex = currentSteps.findIndex((step) => step.id === activeDrag.stepId)
    if (!cancelled && pendingValueRef.current !== null && stepIndex !== -1) {
      onUpdateCurveStepRef.current(currentPalette.id, currentSteps[stepIndex]!.label, activeDrag.channel, pendingValueRef.current)
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    activeDragRef.current = null
    pendingValueRef.current = null
    setDragVisual(null)
    setDrag(null)
    setHover(null)
  }

  function showHover(event: ReactPointerEvent<SVGElement>, channel: CurveChannel, index: number) {
    if (drag || !chartRef.current) return
    const bounds = chartRef.current.getBoundingClientRect()
    setHover({
      channel,
      index,
      left: Math.min(bounds.width - 164, Math.max(8, event.clientX - bounds.left + 12)),
      top: Math.min(bounds.height - 112, Math.max(8, event.clientY - bounds.top - 54)),
    })
  }

  function nudge(channel: CurveChannel, index: number, direction: -1 | 1) {
    const amount = channel === 'hue' ? 1 / HUE_OFFSET_RANGE : 0.01
    const current = curvePlotValue(steps[index]!, baseHue, channel)
    onUpdateCurveStep(palette.id, steps[index]!.label, channel, current + amount * direction)
  }

  return (
    <main className="relative flex-1 min-w-0 overflow-hidden">
      <svg
        ref={chartRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 block w-full h-full touch-none select-none"
        role="img"
        aria-label={`Editable lightness, chroma, and hue curves for ${palette.name}`}
        onPointerLeave={() => { if (!drag) setHover(null) }}
      >
        {displayedSteps.map((step, index) => (
          <rect
            key={step.id}
            x={index * columnWidth}
            y={0}
            width={columnWidth + 0.5}
            height={VIEW_HEIGHT}
            fill={step.hex}
            role="button"
            tabIndex={0}
            aria-label={`Select step ${step.label}`}
            className="cursor-pointer outline-none"
            onClick={() => onSelectStep(step.label)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelectStep(step.label)
              }
            }}
          />
        ))}

        {paths.map((channel, channelIndex) => visible[channel.key] && (
          <g key={channel.key} opacity={1 - channelIndex * 0.12}>
            <polyline
              points={channel.points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="rgba(0,0,0,0.72)"
              strokeWidth={4}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={channel.points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke="rgba(255,255,255,0.92)"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {channel.points.map((point, index) => {
              const step = displayedSteps[index]!
              const editable = isCurveChannelEditable(step, channel.key)
              const correction = sampleCurveCorrection(
                palette.curveCorrections?.[channel.key]?.[palette.activeMode],
                curveSemanticPosition(step, palette.activeMode),
              )
              const locallyAdjusted = Math.abs(correction) > 0.0001
              const active = (hover?.channel === channel.key && hover.index === index)
                || (drag?.channel === channel.key && drag.stepId === step.id)
              const common = {
                onPointerDown: (event: ReactPointerEvent<SVGElement>) => { if (editable) beginDrag(event, channel.key, step.id) },
                onPointerMove: (event: ReactPointerEvent<SVGElement>) => { if (!moveDrag(event)) showHover(event, channel.key, index) },
                onPointerUp: (event: ReactPointerEvent<SVGElement>) => finishDrag(event),
                onPointerCancel: (event: ReactPointerEvent<SVGElement>) => finishDrag(event, true),
                onPointerEnter: (event: ReactPointerEvent<SVGElement>) => showHover(event, channel.key, index),
                onPointerLeave: () => { if (!drag) setHover(null) },
                onFocus: () => setHover({ channel: channel.key, index, left: Math.min(820, Math.max(8, point.x)), top: Math.min(470, Math.max(8, point.y - 44)) }),
                onBlur: () => setHover(null),
                onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
                  if (editable && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                    event.preventDefault()
                    nudge(channel.key, index, event.key === 'ArrowUp' ? 1 : -1)
                  }
                },
              }
              return (
                <g key={step.id}>
                  <circle cx={point.x} cy={point.y} r={18} fill="transparent" {...common} />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={active ? 7 : 3.5}
                    fill="rgba(255,255,255,0.96)"
                    stroke="rgba(0,0,0,0.78)"
                    strokeWidth={locallyAdjusted ? 3 : 1.5}
                    vectorEffect="non-scaling-stroke"
                    style={{ transition: 'r 140ms ease-out' }}
                    className={`outline-none ${editable ? 'cursor-ns-resize' : 'cursor-default opacity-30'}`}
                    role="button"
                    tabIndex={0}
                    aria-disabled={!editable}
                    aria-label={`${step.isBase ? 'Base' : locallyAdjusted ? 'Locally adjusted point' : palette.curveBindings?.[channel.key] ? 'Shared curve point' : step.locked ? 'Anchor' : 'Generated point'}, step ${step.label}, ${curveDisplayValue(step, baseHue, channel.key)}`}
                    {...common}
                  />
                </g>
              )
            })}
          </g>
        ))}
      </svg>

      {canInsert && Array.from({ length: steps.length + 1 }, (_, boundary) => {
        const leftLabel = boundary > 0 ? steps[boundary - 1]!.label : null
        const rightLabel = boundary < steps.length ? steps[boundary]!.label : null
        const label = boundary === 0
          ? 'Insert step before first'
          : boundary === steps.length
            ? 'Insert step after last'
            : `Insert step between ${leftLabel} and ${rightLabel}`
        return (
          <button
            key={boundary}
            type="button"
            aria-label={label}
            title={label}
            onClick={() => onInsertStep?.(leftLabel, rightLabel)}
            className="absolute top-1/2 z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/65 text-white opacity-0 shadow-sm transition-opacity hover:opacity-100 focus:opacity-100"
            style={{ left: boundary === 0 ? 10 : boundary === steps.length ? 'calc(100% - 10px)' : `${(boundary / steps.length) * 100}%` }}
          >
            <IconPlus size={10} stroke={2} />
          </button>
        )
      })}

      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1 p-1 rounded-lg border border-white/20 bg-black/55 text-white shadow-sm backdrop-blur-sm">
        <span className="px-2 text-[11px] font-medium">{palette.name}</span>
        <div className="w-px h-4 bg-white/25" />
        <div className="flex items-center" aria-label="Visible curves">
          {CHANNELS.map((channel) => (
            <span key={channel.key} className="flex items-center">
              <button
                type="button"
                aria-pressed={visible[channel.key]}
                onClick={() => setVisible((current) => ({ ...current, [channel.key]: !current[channel.key] }))}
                className={`flex items-center gap-1.5 h-7 pl-2 pr-1 text-[11px] transition-opacity ${visible[channel.key] ? 'text-white' : 'text-white/45'}`}
              >
                <span className={`block rounded-full bg-current transition-all ${visible[channel.key] ? 'w-1.5 h-1.5' : 'w-1 h-1'}`} />
                {channel.label}
              </button>
              <select
                aria-label={`${channel.label} constraint`}
                title={`${channel.label} constraint strategy`}
                value={palette.curveStrategies?.[channel.key] ?? 'free'}
                onChange={(event) => onUpdateCurveStrategy(palette.id, channel.key, event.target.value as CurveConstraintStrategy)}
                className="h-6 max-w-[72px] rounded border border-white/20 bg-black/25 px-1 text-[9px] text-white outline-none"
              >
                <option value="free">Free</option>
                <option value="monotonic">Monotonic</option>
                <option value="smooth">Smooth</option>
                <option value="anchored">Anchored</option>
              </select>
            </span>
          ))}
        </div>
      </div>

      {hover && displayedSteps[hover.index] && (
        <div
          role="tooltip"
          className="absolute pointer-events-none z-20 min-w-36 px-2.5 py-2 rounded-md border border-white/20 bg-black/75 text-[11px] text-white shadow-lg backdrop-blur-sm tabular-nums"
          style={{ left: hover.left, top: hover.top }}
        >
          <div className="mb-1 text-white/60">Step {displayedSteps[hover.index]!.label}</div>
          {CHANNELS.filter((channel) => visible[channel.key]).map((channel) => (
            <div key={channel.key}>{curveDisplayValue(displayedSteps[hover.index]!, baseHue, channel.key)}</div>
          ))}
          {(displayedSteps[hover.index]!.locked || displayedSteps[hover.index]!.isBase) && (
            <div className="mt-1 text-white/60">{displayedSteps[hover.index]!.isBase ? 'Base' : 'Anchor'}</div>
          )}
        </div>
      )}
    </main>
  )
}
