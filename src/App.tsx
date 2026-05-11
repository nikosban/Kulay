import { useEffect } from 'react'
import { toast } from 'sonner'
import { useProjectStore } from './store/useProjectStore'
import { LibraryScreen } from './components/library/LibraryScreen'
import { ProjectScreen } from './components/project/ProjectScreen'

export default function App() {
  const activeProject = useProjectStore((s) => s.activeProject)
  const loadLibrary = useProjectStore((s) => s.loadLibrary)
  const corruptedCount = useProjectStore((s) => s.corruptedCount)

  useEffect(() => {
    loadLibrary()
  }, [loadLibrary])

  useEffect(() => {
    if (corruptedCount > 0) {
      const msg =
        corruptedCount === 1
          ? 'One project could not be restored and was removed.'
          : `${corruptedCount} projects could not be restored and were removed.`
      toast.error(msg)
    }
  }, [corruptedCount])

  return activeProject ? <ProjectScreen /> : <LibraryScreen />
}
