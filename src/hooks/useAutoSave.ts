import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useProjectStore } from '../store/useProjectStore'
import { saveProject } from '../lib/storage'

const DEBOUNCE_MS = 1500

export function useAutoSave() {
  const activeProject = useProjectStore((s) => s.activeProject)
  const isDirty = useProjectStore((s) => s.isDirty)
  const saveBlocked = useProjectStore((s) => s.saveBlocked)
  const markSaved = useProjectStore((s) => s.markSaved)
  const projectRef = useRef(activeProject)
  projectRef.current = activeProject

  useEffect(() => {
    if (!isDirty || saveBlocked || !activeProject) return

    const id = setTimeout(() => {
      const project = projectRef.current
      if (!project) return
      const timestamp = Date.now()
      try {
        saveProject({ ...project, updatedAt: timestamp })
        markSaved(timestamp)
      } catch {
        toast.error('Auto-save failed. Storage may be full.')
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(id)
  }, [isDirty, saveBlocked, activeProject?.id, markSaved])
}
