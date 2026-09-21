// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CurveEditor } from './CurveEditor'
import { IsolatedCurveEditor } from './IsolatedCurveEditor'
import { generatePaletteForMode } from '../../lib/generatePalette'
import { getActiveSteps, type Project } from '../../types/project'
import { realizeCurvePreview } from '../../lib/savedCurves'
import { useProjectStore } from '../../store/useProjectStore'

const backgrounds = { light: '#ffffff', dark: '#000000' }

beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, 'setPointerCapture', { configurable: true, value: vi.fn() })
  Object.defineProperty(SVGElement.prototype, 'releasePointerCapture', { configurable: true, value: vi.fn() })
  Object.defineProperty(SVGElement.prototype, 'hasPointerCapture', { configurable: true, value: () => true })
})

afterEach(cleanup)

function setChartBounds() {
  const chart = screen.getByRole('img')
  vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 1000, bottom: 600, width: 1000, height: 600,
    toJSON: () => ({}),
  })
  return chart
}

describe('curve editor interactions', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('commits the intent value from a pointer drag', () => {
    const palette = generatePaletteForMode('#2563eb', 10, backgrounds, [], 'light')
    const step = getActiveSteps(palette).find((candidate) => !candidate.isBase)!
    const update = vi.fn()
    render(<CurveEditor palette={palette} onUpdateCurveStep={update} onUpdateCurveStrategy={vi.fn()} onSelectStep={vi.fn()} />)
    setChartBounds()
    const control = screen.getByRole('button', { name: new RegExp(`step ${step.label}, L`) })
    const swatch = screen.getByRole('button', { name: `Select step ${step.label}` })
    const colorBeforeDrag = swatch.getAttribute('fill')

    fireEvent.pointerDown(control, { pointerId: 7, clientY: 100 })
    fireEvent.pointerMove(control, { pointerId: 7, clientX: 200, clientY: 450 })

    expect(swatch.getAttribute('fill')).not.toBe(colorBeforeDrag)
    expect(update).not.toHaveBeenCalled()

    fireEvent.pointerUp(control, { pointerId: 7, clientX: 200, clientY: 450 })

    expect(update).toHaveBeenCalledWith(palette.id, step.label, 'lightness', 0.25)
  })

  it('routes a keyboard edit on the base through the same curve interaction', () => {
    const palette = generatePaletteForMode('#b45309', 10, backgrounds, [], 'light')
    const base = getActiveSteps(palette).find((step) => step.isBase)!
    const update = vi.fn()
    render(<CurveEditor palette={palette} onUpdateCurveStep={update} onUpdateCurveStrategy={vi.fn()} onSelectStep={vi.fn()} />)
    const control = screen.getByRole('button', { name: new RegExp(`Base, step ${base.label}, L`) })

    fireEvent.keyDown(control, { key: 'ArrowUp' })

    expect(update).toHaveBeenCalledWith(palette.id, base.label, 'lightness', base.curveValues.lightness + 0.01)
  })

  it('plots dark-mode columns in visual order while retaining semantic curve order', () => {
    const palette = generatePaletteForMode('#0f766e', 10, backgrounds, [], 'dark')
    render(<CurveEditor palette={palette} onUpdateCurveStep={vi.fn()} onUpdateCurveStrategy={vi.fn()} onSelectStep={vi.fn()} />)
    const lightnessLine = document.querySelector('polyline')!
    const points = lightnessLine.getAttribute('points')!.split(' ').map((point) => Number(point.split(',')[1]))

    expect(points[0]).toBeGreaterThan(points[points.length - 1]!)
    expect(getActiveSteps(palette)[0]!.position).toBe(0)
  })

  it('edits the shared curve without detaching linked palettes', () => {
    const source = generatePaletteForMode('#b45309', 10, backgrounds, [], 'light')
    const target = generatePaletteForMode('#2563eb', 10, backgrounds, [], 'dark')
    const project: Project = {
      id: 'interaction-project', name: 'Interactions', stepCount: 10, backgrounds,
      lightnessRange: { lightest: 0.97, darkest: 0.12 }, palettes: [source, target], createdAt: 1, updatedAt: 1,
    }
    useProjectStore.setState({ activeProject: project, libraryProjects: [project], curvePreview: null, curvePreviewKind: null })
    const curveId = useProjectStore.getState().saveCurve(source.id, 'chroma', 'Shared')!
    useProjectStore.getState().applySavedCurve([target.id], curveId)
    const state = useProjectStore.getState().activeProject!
    const curve = state.savedCurves!.find((candidate) => candidate.id === curveId)!
    const linkedSource = state.palettes.find((palette) => palette.id === source.id)!
    const curveBefore = curve.points[4]!.value
    const updateLinked = vi.fn((pointId: string, value: number) => useProjectStore.getState().updateSavedCurvePoint(curveId, pointId, value))
    render(
      <IsolatedCurveEditor
        curve={curve}
        preview={realizeCurvePreview(linkedSource, curve, backgrounds)}
        selectedPointId={null}
        onSelectPoint={vi.fn()}
        onPreviewPoint={updateLinked}
        onCommitPreview={() => {}}
        onCancelPreview={() => useProjectStore.getState().cancelCurvePreview()}
      />,
    )
    const control = screen.getByRole('button', { name: /^Curve point 5,/ })

    fireEvent.keyDown(control, { key: 'ArrowDown' })

    expect(updateLinked).toHaveBeenCalled()
    expect(useProjectStore.getState().activeProject!.savedCurves!.find((candidate) => candidate.id === curveId)!.points[4]!.value).not.toBe(curveBefore)
    expect(useProjectStore.getState().activeProject!.palettes.every((palette) => palette.curveBindings?.chroma === curveId)).toBe(true)
    expect(useProjectStore.getState().curvePreview).toBeNull()
  })
})
