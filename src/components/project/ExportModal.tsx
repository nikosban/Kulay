import { useState, useRef } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
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
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  if (!project) return null

  const title = scope === 'palette' && palette ? palette.name : project.name

  // ── Export (download) ──────────────────────────────────────────────────────

  async function handleExport() {
    if (!project) return
    setLoading(true)
    setError(null)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
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
      return buildProjectSvgStack(project.palettes)
    }
    return ''
  }

  async function handleCopy() {
    const text = buildCopyText()
    if (!text) return
    setError(null)
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const el = document.createElement('textarea')
        el.value = text
        el.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
        document.body.appendChild(el)
        el.focus()
        el.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(el)
        if (!ok) throw new Error('execCommand failed')
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('Clipboard access denied. Try allowing clipboard permissions for this site.')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        className="bg-surface-base dark:bg-surface-base-dark rounded-xl shadow-xl w-full max-w-sm mx-4 flex flex-col gap-0 overflow-hidden"
      >

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bd-base dark:border-bd-base-dark">
          <h2 id="export-modal-title" className="text-sm font-semibold text-fg-base dark:text-fg-base-dark truncate pr-4">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark transition-colors flex-shrink-0"
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
              onClick={() => { setTab(t); setError(null) }}
              className={[
                'flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
                tab === t
                  ? 'bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-fg-inverted dark:text-fg-inverted-dark'
                  : 'text-fg-muted dark:text-fg-muted-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark',
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

          {/* Error message */}
          {error && (
            <p className="text-xs text-fg-danger dark:text-fg-danger-dark mt-1">{error}</p>
          )}

          {/* Action button */}
          <button
            onClick={tab === 'export' ? handleExport : handleCopy}
            disabled={loading}
            className="mt-2 w-full rounded-lg bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-fg-inverted dark:text-fg-inverted-dark text-sm font-medium py-2 hover:bg-surface-neutral-strong-hover dark:hover:bg-surface-neutral-strong-hover-dark disabled:opacity-50 transition-colors"
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
          ? 'border-bd-primary dark:border-bd-primary-dark bg-surface-neutral-subtle-hover dark:bg-surface-neutral-subtle-hover-dark'
          : 'border-bd-base dark:border-bd-base-dark hover:border-bd-hover dark:hover:border-bd-hover-dark',
      ].join(' ')}
    >
      <input
        type="radio"
        name="format"
        checked={selected}
        onChange={onSelect}
        className="mt-0.5 flex-shrink-0 accent-bd-primary dark:accent-bd-primary-dark"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg-base dark:text-fg-base-dark leading-tight">{label}</p>
        <p className="text-xs text-fg-placeholder dark:text-fg-placeholder-dark mt-0.5">{desc}</p>
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
    const svg = buildSvgRamp(p)
    const inner = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '')
    groups.push(`<g transform="translate(0, ${y})">${inner}</g>`)
    y += TILE_H + GAP
  }

  const maxSteps = Math.max(...palettes.map((p) => p.modes.light.length))
  const totalW = TILE_W * maxSteps
  const totalH = y - GAP

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">\n${groups.join('\n')}\n</svg>`
}
