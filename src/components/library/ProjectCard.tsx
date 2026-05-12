import { useState, useRef, useEffect } from 'react'
import { IconPencil, IconTrash } from '@tabler/icons-react'
import { ButtonSmall } from '../ui/ButtonSmall'
import type { Project } from '../../types/project'
import { getActiveSteps } from '../../types/project'

interface Props {
  project: Project
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => void
  onRemove: (id: string) => void
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ProjectCard({ project, onOpen, onRename, onRemove }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(project.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setDraft(project.name)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing, project.name])

  function commitRename() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== project.name) {
      onRename(project.id, trimmed)
    }
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') setEditing(false)
  }

  const paletteMeta = project.palettes.length === 0
    ? 'No palettes'
    : `${project.palettes.length} palette${project.palettes.length === 1 ? '' : 's'}`

  return (
    <div className="group relative w-full rounded-xl border border-bd-base dark:border-bd-base-dark bg-surface-base dark:bg-surface-base-dark hover:border-bd-strong dark:hover:border-bd-strong-dark hover:shadow-sm transition-all overflow-hidden">

      {/* Color preview strip */}
      {project.palettes.length > 0 && (
        <div className="flex h-16 w-full">
          {project.palettes.map((palette) => {
            const steps = getActiveSteps(palette)
            return (
              <div key={palette.id} className="flex flex-col flex-1 min-w-0">
                {steps.map((step) => (
                  <div key={step.label} className="flex-1" style={{ backgroundColor: step.hex }} />
                ))}
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={() => !editing && onOpen(project.id)}
        className="w-full text-left p-3 pr-16"
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full font-semibold text-fg-base dark:text-fg-base-dark bg-transparent border-b border-bd-strong dark:border-bd-strong-dark outline-none"
          />
        ) : (
          <p className="font-semibold text-fg-base dark:text-fg-base-dark truncate">{project.name}</p>
        )}
        <p className="text-xs text-fg-placeholder dark:text-fg-placeholder-dark mt-1">
          {paletteMeta}{' · '}{formatDate(project.updatedAt)}
        </p>
      </button>

      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <ButtonSmall onClick={(e) => { e.stopPropagation(); setEditing(true) }} title="Rename">
          <IconPencil size={14} stroke={1.75} />
        </ButtonSmall>
        <ButtonSmall variant="danger" onClick={(e) => { e.stopPropagation(); onRemove(project.id) }} title="Remove">
          <IconTrash size={14} stroke={1.75} />
        </ButtonSmall>
      </div>
    </div>
  )
}
