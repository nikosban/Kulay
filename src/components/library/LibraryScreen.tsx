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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <header className="flex items-center justify-between px-6 py-5 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-white">Kulay</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle isDark={isDark} onToggle={toggle} />
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium px-4 py-2 hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors"
          >
            New Project
          </button>
        </div>
      </header>

      <main className="p-6">
        {libraryProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-neutral-400 dark:text-neutral-500 text-sm mb-4">No projects yet.</p>
            <button
              onClick={() => setShowModal(true)}
              className="rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium px-4 py-2 hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto grid gap-3">
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
