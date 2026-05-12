import { useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { useTheme } from '../../contexts/ThemeContext'
import { ProjectCard } from './ProjectCard'
import { ThemeToggle } from '../ui/ThemeToggle'
import { NewProjectModal } from './NewProjectModal'
import type { Palette } from '../../types/project'

export function LibraryScreen() {
  const libraryProjects = useProjectStore((s) => s.libraryProjects)
  const createNewProject = useProjectStore((s) => s.createNewProject)
  const openProject = useProjectStore((s) => s.openProject)
  const renameLibraryProject = useProjectStore((s) => s.renameLibraryProject)
  const removeProject = useProjectStore((s) => s.removeProject)
  const { isDark, toggle } = useTheme()

  const [showModal, setShowModal] = useState(false)

  function handleCreate(palettes: Palette[]) {
    setShowModal(false)
    createNewProject(palettes)
  }

  return (
    <div className="min-h-screen bg-surface-page dark:bg-surface-page-dark">
      <header className="flex items-center justify-between px-6 py-5 border-b border-bd-base dark:border-bd-base-dark bg-surface-base dark:bg-surface-base-dark">
        <h1 className="text-xl font-semibold text-fg-base dark:text-fg-base-dark">Kulay</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle isDark={isDark} onToggle={toggle} />
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-fg-inverted dark:text-fg-inverted-dark text-sm font-medium px-4 py-2 hover:bg-surface-neutral-strong-hover dark:hover:bg-surface-neutral-strong-hover-dark transition-colors"
          >
            New Project
          </button>
        </div>
      </header>

      <main className="p-6">
        {libraryProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-fg-placeholder dark:text-fg-placeholder-dark text-sm mb-4">No projects yet.</p>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-fg-inverted dark:text-fg-inverted-dark text-sm font-medium px-4 py-2 hover:bg-surface-neutral-strong-hover dark:hover:bg-surface-neutral-strong-hover-dark transition-colors"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {libraryProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={openProject}
                onRename={renameLibraryProject}
                onRemove={removeProject}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}
