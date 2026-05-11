import { useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import type { Palette } from '../../types/project'
import { exportProjectKulay, exportPaletteKulay, projectKulayJson, paletteKulayJson } from '../../lib/export/kulayJson'
import { exportProjectTailwind, exportPaletteTailwind } from '../../lib/export/tailwindConfig'
import { exportPaletteSvg, exportProjectSvgZip, buildSvgRamp } from '../../lib/export/svgRamp'
import { projectToMarkdown, paletteToMarkdown } from '../../lib/export/markdown'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'export' | 'copy'
type ExportFormat = 'json' | 'tailwind' | 'svg'
type CopyFormat = 'json' | 'markdown' | 'svg'

const EXPORT_FORMATS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: 'json',     label: 'Kulay JSON',      desc: 'Full project file, re-importable' },
  { id: 'tailwind', label: 'Tailwind Config',  desc: 'Ready to paste into tailwind.config.js' },
  { id: 'svg',      label: 'SVG Ramp',         desc: 'Horizontal color swatch strip' },
]

const COPY_FORMATS: { id: CopyFormat; label: string; desc: string }[] = [
  { id: 'json',     label: 'JSON',     desc: 'Kulay palette data as JSON' },
  { id: 'markdown', label: 'Markdown', desc: 'Color table for docs or Notion' },
  { id: 'svg',      label: 'SVG',      desc: 'SVG ramp markup for embedding' },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  scope: 'project' | 'palette'
  palette?: Palette
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExportModal({ scope, palette, onClose }: Props) {
  const project = useProjectStore((s) => s.activeProject)
  const [tab, setTab] = useState<Tab>('export')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json')
  const [copyFormat, setCopyFormat] = useState<CopyFormat>('json')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!project) return null

  const title = scope === 'palette' && palette ? palette.name : project.name

  // ── Export (download) ──────────────────────────────────────────────────────

  async function handleExport() {
    if (!project) return
    setLoading(true)
    try {
      if (scope === 'project') {
        if (exportFormat === 'json')     exportProjectKulay(project)
        if (exportFormat === 'tailwind') exportProjectTailwind(project)
        if (exportFormat === 'svg')      await exportProjectSvgZip(project.name, project.palettes)
      } else if (palette) {
        if (exportFormat === 'json')     exportPaletteKulay(project, palette)
        if (exportFormat === 'tailwind') exportPaletteTailwind(palette)
        if (exportFormat === 'svg')      exportPaletteSvg(palette)
      }
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // ── Copy (clipboard) ───────────────────────────────────────────────────────

  function buildCopyText(): string {
    if (!project) return ''
    if (copyFormat === 'json') {
      return scope === 'palette' && palette
        ? paletteKulayJson(project, palette)
        : projectKulayJson(project)
    }
    if (copyFormat === 'markdown') {
      return scope === 'palette' && palette
        ? paletteToMarkdown(palette)
        : projectToMarkdown(project)
    }
    if (copyFormat === 'svg') {
      if (scope === 'palette' && palette) return buildSvgRamp(palette)
      // Project: stack all palettes vertically in one SVG
      return buildProjectSvgStack(project.palettes)
    }
    return ''
  }

  async function handleCopy() {
    const text = buildCopyText()
    if (!text) return
    await navigator.clipboard.writeText(text).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl w-full max-w-sm mx-4 flex flex-col gap-0 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white truncate pr-4">{title}</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pt-4 gap-1">
          {(['export', 'copy'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                tab === t
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800',
              ].join(' ')}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Format options */}
        <div className="flex flex-col gap-1.5 px-5 pt-3 pb-5">
          {tab === 'export'
            ? EXPORT_FORMATS.map((f) => (
                <FormatOption
                  key={f.id}
                  label={f.label}
                  desc={f.desc}
                  selected={exportFormat === f.id}
                  onSelect={() => setExportFormat(f.id)}
                />
              ))
            : COPY_FORMATS.map((f) => (
                <FormatOption
                  key={f.id}
                  label={f.label}
                  desc={f.desc}
                  selected={copyFormat === f.id}
                  onSelect={() => setCopyFormat(f.id)}
                />
              ))
          }

          {/* Action button */}
          <button
            onClick={tab === 'export' ? handleExport : handleCopy}
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium py-2 hover:bg-neutral-700 dark:hover:bg-neutral-200 disabled:opacity-50 transition-colors"
          >
            {tab === 'export'
              ? (loading ? 'Exporting…' : 'Download')
              : (copied ? 'Copied ✓' : 'Copy to clipboard')
            }
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Format option row ─────────────────────────────────────────────────────────

function FormatOption({
  label, desc, selected, onSelect,
}: {
  label: string
  desc: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <label
      className={[
        'flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
        selected
          ? 'border-neutral-900 dark:border-white bg-neutral-50 dark:bg-neutral-800'
          : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600',
      ].join(' ')}
    >
      <input
        type="radio"
        name="format"
        checked={selected}
        onChange={onSelect}
        className="mt-0.5 flex-shrink-0 accent-neutral-900 dark:accent-white"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-100 leading-tight">{label}</p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">{desc}</p>
      </div>
    </label>
  )
}

// ── Project SVG stack (all palettes in one SVG) ───────────────────────────────

function buildProjectSvgStack(palettes: Palette[]): string {
  if (palettes.length === 0) return ''
  const GAP = 8
  const TILE_W = 80
  const TILE_H = 120
  let y = 0
  const groups: string[] = []

  for (const p of palettes) {
    const stepCount = p.modes.light.length
    const w = TILE_W * stepCount
    const svg = buildSvgRamp(p)
    // Extract inner content from the palette SVG and offset it
    const inner = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '')
    groups.push(`<g transform="translate(0, ${y})">${inner}</g>`)
    y += TILE_H + GAP
  }

  const maxSteps = Math.max(...palettes.map((p) => p.modes.light.length))
  const totalW = TILE_W * maxSteps
  const totalH = y - GAP

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">\n${groups.join('\n')}\n</svg>`
}
