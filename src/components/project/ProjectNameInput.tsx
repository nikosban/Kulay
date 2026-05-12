import { useRef, useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'

const MAX_LENGTH = 64

export function ProjectNameInput() {
  const name = useProjectStore((s) => s.activeProject?.name ?? '')
  const updateProjectName = useProjectStore((s) => s.updateProjectName)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const prevName = useRef(name)

  function handleFocus() {
    prevName.current = name
    setValue(name)
    setEditing(true)
  }

  function commit() {
    const trimmed = value.trim()
    if (!trimmed) setValue(prevName.current)
    else updateProjectName(trimmed.slice(0, MAX_LENGTH))
    setEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.currentTarget.blur()
    if (e.key === 'Escape') { setValue(prevName.current); setEditing(false); e.currentTarget.blur() }
  }

  return editing ? (
    <input
      autoFocus
      className="text-lg font-semibold text-fg-base dark:text-fg-base-dark bg-transparent border-b border-bd-hover dark:border-bd-hover-dark outline-none min-w-0 max-w-xs"
      value={value}
      maxLength={MAX_LENGTH}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
    />
  ) : (
    <button
      onClick={handleFocus}
      className="text-lg font-semibold text-fg-base dark:text-fg-base-dark hover:text-fg-muted dark:hover:text-fg-subtle-dark transition-colors text-left truncate max-w-xs"
      title="Click to rename"
    >
      {name}
    </button>
  )
}
