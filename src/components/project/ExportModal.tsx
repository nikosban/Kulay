import { useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import type { Palette } from '../../types/project'
import { getExportWarnings } from '../../lib/export/exportWarnings'
import { exportProjectKulay, exportPaletteKulay } from '../../lib/export/kulayJson'
import { exportProjectW3C, exportPaletteW3C } from '../../lib/export/w3cTokens'
import { exportProjectTailwind, exportPaletteTailwind } from '../../lib/export/tailwindConfig'
import { exportPaletteSvg, exportProjectSvgZip } from '../../lib/export/svgRamp'

type Format = 'kulay' | 'w3c' | 'tailwind' | 'svg'

const FORMATS: { id: Format; label: string; desc: string }[] = [
  { id: 'kulay', label: 'JSON — Kulay', desc: 'Re-importable Kulay project file' },
  { id: 'w3c', label: 'JSON — W3C Tokens', desc: 'W3C Design Token Community Group format' },
  { id: 'tailwind', label: 'Tailwind Config', desc: 'Ready to paste into tailwind.config.js' },
  { id: 'svg', label: 'SVG Ramp', desc: 'Horizontal color swatch strip' },
]

interface Props {
  scope: 'project' | 'palette'
  palette?: Palette
  onClose: () => void
}

export function ExportModal({ scope, palette, onClose }: Props) {
  const project = useProjectStore((s) => s.activeProject)
  const [format, setFormat] = useState<Format>('kulay')
  const [loading, setLoading] = useState(false)

  if (!project) return null

  const palettes = scope === 'palette' && palette ? [palette] : project.palettes
  const warnings = getExportWarnings(palettes)
  const hasWarnings = warnings.duplicateNames.length > 0 || warnings.tailwindConflicts.length > 0

  async function handleExport() {
    if (!project) return
    setLoading(true)
    try {
      if (scope === 'project') {
        if (format === 'kulay') exportProjectKulay(project)
        else if (format === 'w3c') exportProjectW3C(project)
        else if (format === 'tailwind') exportProjectTailwind(project)
        else if (format === 'svg') await exportProjectSvgZip(project.name, project.palettes)
      } else if (palette) {
        if (format === 'kulay') exportPaletteKulay(project, palette)
        else if (format === 'w3c') exportPaletteW3C(palette)
        else if (format === 'tailwind') exportPaletteTailwind(palette)
        else if (format === 'svg') exportPaletteSvg(palette)
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
            Export {scope === 'palette' && palette ? palette.name : project.name}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 text-lg leading-none">×</button>
        </div>

        <div className="flex flex-col gap-1.5">
          {FORMATS.map((f) => (
            <label
              key={f.id}
              className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                format === f.id
                  ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
              }`}
            >
              <input type="radio" name="format" value={f.id} checked={format === f.id} onChange={() => setFormat(f.id)} className="mt-0.5" />
              <div>
                <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100">{f.label}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500">{f.desc}</p>
              </div>
            </label>
          ))}
        </div>

        {hasWarnings && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-400">Warnings</p>
            {warnings.duplicateNames.length > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-500">
                Two or more palettes share the same name. This may cause conflicts in some formats.
              </p>
            )}
            {warnings.tailwindConflicts.map((name) => (
              <p key={name} className="text-xs text-amber-700 dark:text-amber-500">
                <span className="font-medium">{name}</span> matches a Tailwind default color name. Consider renaming to avoid conflicts.
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={loading}
            className="flex-1 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium py-2 hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
          >
            {loading ? 'Exporting…' : 'Download'}
          </button>
          <button
            onClick={onClose}
            className="px-4 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 text-sm font-medium py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
