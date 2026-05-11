import type { Project } from '../types/project'
import { serializeProject, deserializeProject, CorruptedProjectError } from './serialization'

export { CorruptedProjectError }

const PREFIX = 'kulay_project_'

export function projectKey(id: string): string {
  return `${PREFIX}${id}`
}

export function listProjectIds(): string[] {
  const ids: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key?.startsWith(PREFIX)) {
      ids.push(key.slice(PREFIX.length))
    }
  }
  return ids
}

export function saveProject(project: Project): void {
  try {
    localStorage.setItem(projectKey(project.id), serializeProject(project))
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      throw e
    }
    throw e
  }
}

export function loadProject(id: string): Project {
  const raw = localStorage.getItem(projectKey(id))
  if (raw === null) throw new CorruptedProjectError(id)
  return deserializeProject(raw, id)
}

export function deleteProject(id: string): void {
  localStorage.removeItem(projectKey(id))
}
