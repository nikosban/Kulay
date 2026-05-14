import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { IconPlus, IconTrash, IconGripVertical } from '@tabler/icons-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useProjectStore } from '../../store/useProjectStore'
import type { Palette } from '../../types/project'
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

function SortablePaletteRow({
  palette,
  isSelected,
  onSelect,
  onDelete,
}: {
  palette: Palette
  isSelected: boolean
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: palette.id })
  const steps = getActiveSteps(palette)

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect() }}
      className={`group flex items-center gap-1 px-2 py-2 cursor-pointer transition-colors ${
        isSelected
          ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark/80'
          : 'hover:bg-surface-neutral-subtle-active/60 dark:hover:bg-surface-neutral-subtle-active-dark/40'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
        aria-label="Drag to reorder"
        className="flex-shrink-0 w-4 flex items-center justify-center text-fg-placeholder dark:text-fg-placeholder-dark opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity touch-none"
      >
        <IconGripVertical size={12} stroke={1.75} />
      </button>

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
          onClick={onDelete}
          title="Delete palette"
          className="w-6 h-6 flex items-center justify-center rounded text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-danger dark:hover:text-fg-danger-dark hover:bg-surface-danger-subtle-rest dark:hover:bg-surface-danger-subtle-rest-dark transition-colors"
        >
          <IconTrash size={12} stroke={1.75} />
        </button>
      </div>
    </div>
  )
}

interface Props {
  onBack: () => void
  activeTab: 'colors' | 'tokens'
  onTabChange: (tab: 'colors' | 'tokens') => void
  selectedPaletteId: string | null
  onSelectPalette: (id: string | null) => void
}

export function ProjectSidebar({ onBack, activeTab, onTabChange, selectedPaletteId, onSelectPalette }: Props) {
  const activeProject = useProjectStore((s) => s.activeProject)
  const addPalette = useProjectStore((s) => s.addPalette)
  const reorderPalettes = useProjectStore((s) => s.reorderPalettes)
  const deletePalette = useProjectStore((s) => s.deletePalette)
  const undoDeletePalette = useProjectStore((s) => s.undoDeletePalette)
  const projectName = useProjectStore((s) => s.activeProject?.name ?? '')
  const updateProjectName = useProjectStore((s) => s.updateProjectName)

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const prevName = useRef('')

  const [showAdder, setShowAdder] = useState(false)
  const [adderValue, setAdderValue] = useState('')
  const adderRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  if (!activeProject) return null

  const palettes = activeProject.palettes
  const atLimit = palettes.length >= PALETTE_LIMIT

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = palettes.findIndex((p) => p.id === active.id)
    const newIndex = palettes.findIndex((p) => p.id === over.id)
    const reordered = arrayMove(palettes, oldIndex, newIndex)
    reorderPalettes(reordered.map((p) => p.id))
  }

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

      {/* ── Tab bar ── */}
      <div className="flex border-b border-bd-base dark:border-bd-base-dark flex-shrink-0">
        {(['colors', 'tokens'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`flex-1 py-2 text-[11px] font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-fg-base dark:text-fg-base-dark border-b-2 border-fg-base dark:border-fg-base-dark -mb-px'
                : 'text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-muted dark:hover:text-fg-muted-dark'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Colors ── */}
      {activeTab === 'colors' && <div className="flex flex-col flex-1 overflow-hidden">

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

          {palettes.length === 0 && !showAdder && (
            <p className="text-[11px] text-fg-placeholder dark:text-fg-placeholder-dark px-3 py-2">
              No colors yet.
            </p>
          )}

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={palettes.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              {palettes.map((palette) => (
                <SortablePaletteRow
                  key={palette.id}
                  palette={palette}
                  isSelected={palette.id === selectedPaletteId}
                  onSelect={() => onSelectPalette(palette.id)}
                  onDelete={(e) => handleDelete(e, palette.id, palette.name)}
                />
              ))}
            </SortableContext>
          </DndContext>

          {/* Inline hex adder */}
          {showAdder && (
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-1 rounded-md border border-bd-strong dark:border-bd-strong-dark bg-surface-base dark:bg-surface-base-dark px-2 h-8">
                <span className="text-[11px] text-fg-placeholder dark:text-fg-placeholder-dark select-none">#</span>
                {(() => {
                  const preview = sanitizeHex(adderValue)
                  return preview ? (
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0 border border-bd-base dark:border-bd-base-dark"
                      style={{ backgroundColor: preview.hex }}
                    />
                  ) : null
                })()}
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

          {/* Add color row */}
          {!showAdder && (
            <button
              onClick={openAdder}
              disabled={atLimit}
              title={atLimit ? `Maximum of ${PALETTE_LIMIT} palettes reached` : undefined}
              className="flex items-center gap-1.5 w-full px-3 py-2 text-[12px] text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-muted dark:hover:text-fg-muted-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <IconPlus size={12} stroke={2} />
              Add color
            </button>
          )}
        </div>
      </div>}

      {/* ── Tokens tab ── */}
      {activeTab === 'tokens' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto py-1">
            <p className="text-[11px] text-fg-placeholder dark:text-fg-placeholder-dark px-3 py-2">
              Token groups appear here.
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
