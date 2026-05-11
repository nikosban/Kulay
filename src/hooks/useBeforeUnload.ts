import { useEffect } from 'react'
import { useProjectStore } from '../store/useProjectStore'

export function useBeforeUnload() {
  const isDirty = useProjectStore((s) => s.isDirty)

  useEffect(() => {
    if (!isDirty) return

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      // returnValue required for cross-browser support
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])
}
