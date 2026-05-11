import { useEffect, useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'

function formatRelative(ms: number): string {
  const minutes = Math.floor((Date.now() - ms) / 60_000)
  if (minutes < 1) return 'Saved just now'
  if (minutes === 1) return 'Saved 1 minute ago'
  return `Saved ${minutes} minutes ago`
}

export function SavedTimestamp() {
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt)
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  if (lastSavedAt === null) return null

  return (
    <span className="text-xs text-neutral-400 dark:text-neutral-500 select-none">
      {formatRelative(lastSavedAt)}
    </span>
  )
}
