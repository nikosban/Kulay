import { useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import type { TokenRef } from '../../types/tokens'
import { resolveTheme } from '../../lib/tokenResolve'
import { TokenEditor } from './TokenEditor'
import { TokenPreview } from './TokenPreview'

export function TokensView() {
  const palettes          = useProjectStore((s) => s.activeProject?.palettes ?? [])
  const theme             = useProjectStore((s) => s.activeProject?.theme ?? null)
  const suggestTokenTheme = useProjectStore((s) => s.suggestTokenTheme)
  const assignToken       = useProjectStore((s) => s.assignToken)

  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light')

  const resolved = theme ? resolveTheme(theme, palettes, previewMode) : {}

  return (
    <div className="flex flex-1 overflow-hidden">

      {/* ── Token editor (left) ── */}
      <div className="flex flex-col w-[320px] flex-shrink-0 border-r border-bd-base dark:border-bd-base-dark overflow-hidden">
        <TokenEditor
          theme={theme}
          palettes={palettes}
          onSuggest={suggestTokenTheme}
          onAssign={(tokenId: string, mode: 'light' | 'dark', ref: TokenRef | null) =>
            assignToken(tokenId, mode, ref)
          }
        />
      </div>

      {/* ── Preview (right) ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Preview toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-bd-base dark:border-bd-base-dark flex-shrink-0 bg-surface-page dark:bg-surface-page-dark">
          <span className="text-[11px] font-medium text-fg-muted dark:text-fg-muted-dark">Preview</span>
          <div className="flex items-center rounded-md border border-bd-base dark:border-bd-base-dark overflow-hidden">
            {(['light', 'dark'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPreviewMode(m)}
                className={`px-3 h-7 text-[11px] capitalize transition-colors ${
                  previewMode === m
                    ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark text-fg-base dark:text-fg-base-dark font-medium'
                    : 'text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-subtle dark:hover:text-fg-subtle-dark'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {theme ? (
          <TokenPreview tokens={resolved} mode={previewMode} />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-[12px] text-fg-placeholder dark:text-fg-placeholder-dark">
              Generate tokens to see the preview.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
