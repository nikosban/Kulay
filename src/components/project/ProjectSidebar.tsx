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
    const C = 0.12 + Math.random() * 0.10
    const L = 0.48 + Math.random() * 0.20
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
    <div className="w-[240px] flex-shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-700 bg-[#F0F0F0] dark:bg-neutral-900 overflow-hidden">

      {/* ── Nav ── */}
      <div className="flex flex-col gap-2 p-3 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[11px] text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors w-fit"
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
            className="text-[13px] font-semibold text-neutral-900 dark:text-white bg-transparent border-b border-neutral-400 dark:border-neutral-500 outline-none w-full"
          />
        ) : (
          <button
            onClick={startEditName}
            className="text-[13px] font-semibold text-neutral-900 dark:text-white hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors text-left truncate w-full"
            title="Click to rename"
          >
            {projectName}
          </button>
        )}
      </div>

      {/* ── Colors ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Section header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 dark:border-neutral-700 flex-shrink-0">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">Colors</span>
          <button
            onClick={handleAddRandom}
            disabled={atLimit}
            title={atLimit ? `Maximum of ${PALETTE_LIMIT} palettes reached` : 'Add a random color'}
            className="h-6 px-2 flex items-center gap-1 text-[10px] text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-white border border-neutral-200 dark:border-neutral-600 rounded-md bg-white dark:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                ? 'bg-neutral-200 dark:bg-neutral-700/80'
                : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-700/40'
            }`}
          >
            <span className={`text-[12px] leading-none ${
              selectedPaletteId === null
                ? 'text-neutral-900 dark:text-white font-medium'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}>
              All colors
            </span>
          </div>

          {palettes.length === 0 && (
            <p className="text-[11px] text-neutral-400 dark:text-neutral-500 px-3 py-2">
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
                    ? 'bg-neutral-200 dark:bg-neutral-700/80'
                    : 'hover:bg-neutral-200/60 dark:hover:bg-neutral-700/40'
                }`}
              >
                <span className={`flex-1 min-w-0 truncate text-[12px] leading-none ${
                  isSelected
                    ? 'text-neutral-900 dark:text-white font-medium'
                    : 'text-neutral-700 dark:text-neutral-300'
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
                    className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
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
