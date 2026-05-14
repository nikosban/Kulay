import { useState, useRef, useEffect } from 'react'
import { IconSparkles, IconRefresh, IconX } from '@tabler/icons-react'
import type { Palette } from '../../types/project'
import type { Theme, ThemeToken, TokenRef } from '../../types/tokens'
import { getActiveSteps } from '../../types/project'
import { resolveToken, isBrokenRef } from '../../lib/tokenResolve'

// ── Step picker popover ───────────────────────────────────────────────────────

function StepPicker({
  palettes,
  current,
  onSelect,
  onClear,
  onClose,
}: {
  palettes: Palette[]
  current: TokenRef | null
  onSelect: (ref: TokenRef) => void
  onClear: () => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-full left-0 mt-1 z-50 bg-surface-base dark:bg-surface-base-dark border border-bd-base dark:border-bd-base-dark rounded-lg shadow-lg p-2 w-56"
    >
      <div className="flex flex-col gap-2">
        {palettes.map((palette) => {
          const steps = getActiveSteps(palette)
          return (
            <div key={palette.id} className="flex flex-col gap-1">
              <span className="text-[9px] font-medium text-fg-placeholder dark:text-fg-placeholder-dark uppercase tracking-wide px-0.5">
                {palette.name}
              </span>
              <div className="flex gap-[3px] flex-wrap">
                {steps.map((step) => {
                  const isActive = current?.paletteId === palette.id && current?.stepLabel === step.label
                  return (
                    <button
                      key={step.label}
                      title={`${palette.name} ${step.label} — ${step.hex}`}
                      onClick={() => { onSelect({ paletteId: palette.id, stepLabel: step.label }); onClose() }}
                      className={`w-5 h-5 rounded flex-shrink-0 transition-transform hover:scale-110 ${isActive ? 'ring-2 ring-offset-1 ring-fg-base dark:ring-fg-base-dark' : ''}`}
                      style={{ backgroundColor: step.hex }}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
        {current && (
          <button
            onClick={() => { onClear(); onClose() }}
            className="flex items-center gap-1 text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-danger dark:hover:text-fg-danger-dark pt-1 border-t border-bd-base dark:border-bd-base-dark transition-colors"
          >
            <IconX size={10} />
            Clear
          </button>
        )}
      </div>
    </div>
  )
}

// ── Token row ─────────────────────────────────────────────────────────────────

function TokenRow({
  token,
  palettes,
  onAssign,
}: {
  token: ThemeToken
  palettes: Palette[]
  onAssign: (mode: 'light' | 'dark', ref: TokenRef | null) => void
}) {
  const [picker, setPicker] = useState<'light' | 'dark' | null>(null)

  const lightHex = token.light ? resolveToken(token, palettes, 'light') : null
  const darkHex  = token.dark  ? resolveToken(token, palettes, 'dark')  : null
  const lightBroken = token.light ? isBrokenRef(token.light, palettes) : false
  const darkBroken  = token.dark  ? isBrokenRef(token.dark,  palettes) : false

  function swatchClass(broken: boolean) {
    return `w-5 h-5 rounded border flex-shrink-0 cursor-pointer transition-transform hover:scale-110 ${
      broken ? 'border-red-400 dark:border-red-500' : 'border-bd-base dark:border-bd-base-dark'
    }`
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 group hover:bg-surface-neutral-subtle-active/40 dark:hover:bg-surface-neutral-subtle-active-dark/20 rounded">
      <div className="flex-1 min-w-0">
        <span className="text-[11px] font-mono text-fg-subtle dark:text-fg-subtle-dark truncate block">
          {token.name}
        </span>
        <span className="text-[9px] text-fg-placeholder dark:text-fg-placeholder-dark truncate block">
          {token.description}
        </span>
      </div>

      {/* Light swatch */}
      <div className="relative flex-shrink-0">
        <button
          title={lightBroken ? 'Broken reference — click to reassign' : `Light: ${lightHex ?? 'unset'}`}
          onClick={() => setPicker(picker === 'light' ? null : 'light')}
          className={swatchClass(lightBroken)}
          style={{ backgroundColor: lightHex ?? 'transparent' }}
        >
          {!lightHex && <span className="w-full h-full flex items-center justify-center text-[8px] text-fg-placeholder dark:text-fg-placeholder-dark">+</span>}
        </button>
        {picker === 'light' && (
          <StepPicker
            palettes={palettes}
            current={token.light}
            onSelect={(ref) => onAssign('light', ref)}
            onClear={() => onAssign('light', null)}
            onClose={() => setPicker(null)}
          />
        )}
      </div>

      {/* Dark swatch */}
      <div className="relative flex-shrink-0">
        <button
          title={darkBroken ? 'Broken reference — click to reassign' : `Dark: ${darkHex ?? 'unset'}`}
          onClick={() => setPicker(picker === 'dark' ? null : 'dark')}
          className={swatchClass(darkBroken)}
          style={{ backgroundColor: darkHex ?? 'transparent' }}
        >
          {!darkHex && <span className="w-full h-full flex items-center justify-center text-[8px] text-fg-placeholder dark:text-fg-placeholder-dark">+</span>}
        </button>
        {picker === 'dark' && (
          <StepPicker
            palettes={palettes}
            current={token.dark}
            onSelect={(ref) => onAssign('dark', ref)}
            onClear={() => onAssign('dark', null)}
            onClose={() => setPicker(null)}
          />
        )}
      </div>
    </div>
  )
}

// ── Token group ───────────────────────────────────────────────────────────────

function TokenGroupSection({
  name,
  tokens,
  palettes,
  onAssign,
}: {
  name: string
  tokens: ThemeToken[]
  palettes: Palette[]
  onAssign: (tokenId: string, mode: 'light' | 'dark', ref: TokenRef | null) => void
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 sticky top-0 bg-surface-sunken dark:bg-surface-sunken-dark z-10">
        <span className="text-[10px] font-semibold text-fg-muted dark:text-fg-muted-dark uppercase tracking-wide">{name}</span>
      </div>
      {tokens.map((token) => (
        <TokenRow
          key={token.id}
          token={token}
          palettes={palettes}
          onAssign={(mode, ref) => onAssign(token.id, mode, ref)}
        />
      ))}
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

interface Props {
  theme: Theme | null
  palettes: Palette[]
  onSuggest: () => void
  onAssign: (tokenId: string, mode: 'light' | 'dark', ref: TokenRef | null) => void
}

export function TokenEditor({ theme, palettes, onSuggest, onAssign }: Props) {
  if (!theme) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 p-8 text-center">
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-medium text-fg-base dark:text-fg-base-dark">No tokens yet</p>
          <p className="text-[11px] text-fg-placeholder dark:text-fg-placeholder-dark max-w-xs">
            Generate a starter token set from your palettes, then adjust the mappings to fit your design.
          </p>
        </div>
        <button
          onClick={onSuggest}
          disabled={palettes.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-fg-inverted dark:text-fg-inverted-dark text-[12px] font-medium hover:bg-surface-neutral-strong-hover dark:hover:bg-surface-neutral-strong-hover-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <IconSparkles size={13} />
          Generate tokens
        </button>
        {palettes.length === 0 && (
          <p className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">Add palettes first.</p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bd-base dark:border-bd-base-dark flex-shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">Token</span>
          <div className="flex items-center gap-6 ml-auto">
            <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">Light</span>
            <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">Dark</span>
          </div>
        </div>
        <button
          onClick={onSuggest}
          title="Re-suggest from current palettes"
          className="flex items-center gap-1 text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-muted dark:hover:text-fg-muted-dark transition-colors"
        >
          <IconRefresh size={11} />
          Sync
        </button>
      </div>

      {/* Token list */}
      <div className="flex-1 overflow-y-auto pb-6">
        {theme.groups.map((group) => (
          <TokenGroupSection
            key={group.id}
            name={group.name}
            tokens={group.tokens}
            palettes={palettes}
            onAssign={onAssign}
          />
        ))}
      </div>
    </div>
  )
}
