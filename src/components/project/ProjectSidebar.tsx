import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import { useProjectStore } from '../../store/useProjectStore'
import { getActiveSteps } from '../../types/project'
import { generatePalette, validateBasePosition } from '../../lib/generatePalette'
import { oklchToHex, clampToGamut } from '../../lib/color'

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

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const prevName = useRef('')

  if (!activeProject) return null

  const palettes = activeProject.palettes
  const atLimit = palettes.length >= PALETTE_LIMIT

  function handleAddRandom() {
    if (atLimit) return
    const hex = generateRandomHex(activeProject!.stepCount, activeProject!.lightnessRange)
    if (!hex) { toast.error('Could not generate a valid random color. Try again.'); return }
    const palette = generatePalette(
      hex,
      activeProject!.stepCount,
      activeProject!.backgrounds,
      activeProject!.palettes,
      activeProject!.lightnessRange,
    )
    addPalette(palette)
    onSelectPalette(palette.id)
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

      {/* ── Colors ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-bd-base dark:border-bd-base-dark flex-shrink-0">
          <span className="text-[11px] font-medium text-fg-muted dark:text-fg-muted-dark">Colors</span>
          <button
            onClick={handleAddRandom}
            disabled={atLimit}
            title={atLimit ? `Maximum of ${PALETTE_LIMIT} palettes reached` : 'Add a random color'}
            className="h-6 px-2 flex items-center gap-1 text-[10px] text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark border border-bd-base dark:border-bd-hover-dark rounded-md bg-surface-control dark:bg-surface-control-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <IconPlus size={10} stroke={2.5} />
            Add color
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

          {palettes.length === 0 && (
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
    </div>
  )
}
