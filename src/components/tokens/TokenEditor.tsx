import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { IconSparkles, IconRefresh, IconX, IconChevronDown, IconChevronRight, IconAlertTriangle } from '@tabler/icons-react'
import type { Palette } from '../../types/project'
import type { Theme, ThemeToken, TokenGroup, TokenRef } from '../../types/tokens'
import { getActiveSteps } from '../../types/project'
import { resolveToken, isBrokenRef } from '../../lib/tokenResolve'
import type { PaletteRole } from '../../lib/tokenSuggest'

// ── Tree parsing ──────────────────────────────────────────────────────────────

type TreeLeaf   = { kind: 'leaf';   token: ThemeToken; label: string }
type TreeBranch = { kind: 'branch'; label: string; children: Array<{ token: ThemeToken; label: string }> }
type TreeNode   = TreeLeaf | TreeBranch

function buildTree(tokens: ThemeToken[], groupId: string): TreeNode[] {
  const nodes: TreeNode[] = []
  for (const token of tokens) {
    const rest  = token.id.startsWith(groupId + '/') ? token.id.slice(groupId.length + 1) : token.id
    const parts = rest.split('/')
    if (parts.length === 1) {
      nodes.push({ kind: 'leaf', token, label: parts[0] })
    } else {
      const branchLabel = parts[0]
      const leafLabel   = parts.slice(1).join('/')
      const last = nodes[nodes.length - 1]
      if (last?.kind === 'branch' && last.label === branchLabel) {
        last.children.push({ token, label: leafLabel })
      } else {
        nodes.push({ kind: 'branch', label: branchLabel, children: [{ token, label: leafLabel }] })
      }
    }
  }
  return nodes
}

// ── Tree connector ────────────────────────────────────────────────────────────

function TreeConnector({ isLast }: { isLast: boolean }) {
  return (
    <div aria-hidden className="relative self-stretch flex-shrink-0" style={{ width: 18 }}>
      {/* Vertical line — stops at midpoint for last item, full height otherwise */}
      <div
        className="absolute left-[5px] top-0 w-px bg-bd-base dark:bg-bd-base-dark opacity-40"
        style={{ bottom: isLast ? '50%' : 0 }}
      />
      {/* Horizontal elbow */}
      <div className="absolute left-[5px] top-1/2 h-px w-[9px] bg-bd-base dark:bg-bd-base-dark opacity-40" />
    </div>
  )
}

// ── Step picker popover (portal) ──────────────────────────────────────────────

export function StepPicker({
  anchorRect,
  palettes,
  current,
  onSelect,
  onClear,
  onClose,
}: {
  anchorRect: DOMRect
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

  const POPUP_WIDTH  = 224
  const POPUP_HEIGHT = 320 // generous estimate; real height may be less
  const GAP = 6

  const spaceBelow = window.innerHeight - anchorRect.bottom - GAP
  const spaceAbove = anchorRect.top - GAP
  const openAbove  = spaceBelow < POPUP_HEIGHT && spaceAbove > spaceBelow

  const left    = Math.min(anchorRect.left, window.innerWidth - POPUP_WIDTH - 8)
  const top     = openAbove ? undefined : anchorRect.bottom + GAP
  const bottom  = openAbove ? window.innerHeight - anchorRect.top + GAP : undefined
  const maxH    = openAbove
    ? Math.min(spaceAbove, POPUP_HEIGHT)
    : Math.min(spaceBelow, POPUP_HEIGHT)

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', top, bottom, left, zIndex: 9999, width: POPUP_WIDTH, maxHeight: maxH, overflowY: 'auto' }}
      className="bg-surface-base dark:bg-surface-base-dark border border-bd-base dark:border-bd-base-dark rounded-lg shadow-lg p-2"
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
    </div>,
    document.body,
  )
}

// ── Token row ─────────────────────────────────────────────────────────────────

function TokenRow({
  token,
  label,
  connector,
  isLast,
  palettes,
  isMissing,
  onAssign,
}: {
  token: ThemeToken
  label: string
  connector?: boolean
  isLast?: boolean
  palettes: Palette[]
  isMissing: boolean
  onAssign: (mode: 'light' | 'dark', ref: TokenRef | null) => void
}) {
  const [pickerState, setPickerState] = useState<{ mode: 'light' | 'dark'; rect: DOMRect } | null>(null)

  const lightHex    = token.light ? resolveToken(token, palettes, 'light') : null
  const darkHex     = token.dark  ? resolveToken(token, palettes, 'dark')  : null
  const lightBroken = token.light ? isBrokenRef(token.light, palettes, 'light') : false
  const darkBroken  = token.dark  ? isBrokenRef(token.dark,  palettes, 'dark')  : false

  function swatchClass(hex: string | null, broken: boolean) {
    const base = 'w-5 h-5 rounded border flex-shrink-0 cursor-pointer transition-transform hover:scale-110'
    if (broken) return `${base} border-amber-400 dark:border-amber-500`
    if (!hex && isMissing) return `${base} border-dashed border-amber-400 dark:border-amber-500`
    return `${base} border-bd-base dark:border-bd-base-dark`
  }

  function openPicker(e: React.MouseEvent<HTMLButtonElement>, mode: 'light' | 'dark') {
    const rect = e.currentTarget.getBoundingClientRect()
    setPickerState(pickerState?.mode === mode ? null : { mode, rect })
  }

  return (
    <div
      title={token.description}
      className={`flex items-center gap-2 py-1 group rounded ${
        isMissing && !token.light && !token.dark
          ? 'hover:bg-amber-50 dark:hover:bg-amber-950/20'
          : 'hover:bg-surface-neutral-subtle-active/40 dark:hover:bg-surface-neutral-subtle-active-dark/20'
      }`}
      style={{ paddingRight: 12, paddingLeft: connector ? 0 : 10 }}
    >
      {connector && <TreeConnector isLast={isLast ?? false} />}

      <span className="flex-1 min-w-0 truncate text-[11px] font-mono text-fg-subtle dark:text-fg-subtle-dark">
        {label}
      </span>

      {/* Light swatch */}
      <button
        title={lightBroken ? 'Broken reference — click to reassign' : `Light: ${lightHex ?? 'unset'}`}
        onClick={(e) => openPicker(e, 'light')}
        className={swatchClass(lightHex, lightBroken)}
        style={{ backgroundColor: lightHex ?? 'transparent' }}
      >
        {!lightHex && (
          <span className={`w-full h-full flex items-center justify-center text-[8px] ${
            isMissing ? 'text-amber-400 dark:text-amber-500' : 'text-fg-placeholder dark:text-fg-placeholder-dark'
          }`}>+</span>
        )}
      </button>

      {/* Dark swatch */}
      <button
        title={darkBroken ? 'Broken reference — click to reassign' : `Dark: ${darkHex ?? 'unset'}`}
        onClick={(e) => openPicker(e, 'dark')}
        className={swatchClass(darkHex, darkBroken)}
        style={{ backgroundColor: darkHex ?? 'transparent' }}
      >
        {!darkHex && (
          <span className={`w-full h-full flex items-center justify-center text-[8px] ${
            isMissing ? 'text-amber-400 dark:text-amber-500' : 'text-fg-placeholder dark:text-fg-placeholder-dark'
          }`}>+</span>
        )}
      </button>

      {pickerState && (
        <StepPicker
          anchorRect={pickerState.rect}
          palettes={palettes}
          current={pickerState.mode === 'light' ? token.light : token.dark}
          onSelect={(ref) => onAssign(pickerState.mode, ref)}
          onClear={() => onAssign(pickerState.mode, null)}
          onClose={() => setPickerState(null)}
        />
      )}
    </div>
  )
}

// ── Role selector ─────────────────────────────────────────────────────────────

const SEMANTIC_ROLES: { role: PaletteRole; label: string; fallbackColor: string }[] = [
  { role: 'brand',       label: 'Brand',       fallbackColor: '#8b5cf6' },
  { role: 'neutral',     label: 'Neutral',     fallbackColor: '#a3a3a3' },
  { role: 'danger',      label: 'Danger',      fallbackColor: '#ef4444' },
  { role: 'success',     label: 'Success',     fallbackColor: '#22c55e' },
  { role: 'warning',     label: 'Warning',     fallbackColor: '#f59e0b' },
  { role: 'informative', label: 'Informative', fallbackColor: '#3b82f6' },
  { role: 'discovery',   label: 'Discovery',   fallbackColor: '#06b6d4' },
]

function getCurrentPaletteIdForRole(theme: Theme, role: PaletteRole): string | null {
  const counts = new Map<string, number>()
  for (const group of theme.groups) {
    for (const token of group.tokens) {
      if (!token.id.split('/').includes(role)) continue
      if (token.light?.paletteId) counts.set(token.light.paletteId, (counts.get(token.light.paletteId) ?? 0) + 1)
      if (token.dark?.paletteId)  counts.set(token.dark.paletteId,  (counts.get(token.dark.paletteId)  ?? 0) + 1)
    }
  }
  if (counts.size === 0) return null
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function RoleSelector({
  theme,
  palettes,
  missingRoles,
  onAssignRole,
  onGenerateRole,
}: {
  theme: Theme
  palettes: Palette[]
  missingRoles: PaletteRole[]
  onAssignRole: (role: PaletteRole, paletteId: string) => void
  onGenerateRole: (role: PaletteRole) => void
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border-b border-bd-base dark:border-bd-base-dark flex-shrink-0">
      {/* Section header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full px-3 py-2 text-left hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
      >
        {open
          ? <IconChevronDown size={10} className="text-fg-placeholder dark:text-fg-placeholder-dark flex-shrink-0" />
          : <IconChevronRight size={10} className="text-fg-placeholder dark:text-fg-placeholder-dark flex-shrink-0" />
        }
        <span className="text-[10px] font-semibold text-fg-muted dark:text-fg-muted-dark uppercase tracking-wide flex-1">
          Palette roles
        </span>
        {missingRoles.length > 0 && (
          <span className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
            <IconAlertTriangle size={9} />
            {missingRoles.length}
          </span>
        )}
      </button>

      {open && (
        <div className="flex flex-col pb-1.5">
          {SEMANTIC_ROLES.map(({ role, label, fallbackColor }) => {
            const currentPaletteId = getCurrentPaletteIdForRole(theme, role)
            const currentPalette   = palettes.find((p) => p.id === currentPaletteId)
            const isMissing        = missingRoles.includes(role)

            // Swatch: mid-tone step from the assigned palette, or fallback colour
            const swatchSteps  = currentPalette ? getActiveSteps(currentPalette) : null
            const swatchHex    = swatchSteps
              ? swatchSteps[Math.floor(swatchSteps.length * 0.45)]?.hex ?? fallbackColor
              : null

            function handleChange(paletteId: string) {
              if (paletteId === '__generate__') onGenerateRole(role)
              else if (paletteId) onAssignRole(role, paletteId)
            }

            return (
              <div key={role} className="flex items-center gap-2 px-3 py-[3px]">
                {/* Colour dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: swatchHex ?? fallbackColor, opacity: isMissing ? 0.35 : 1 }}
                />

                <span className={`text-[10px] w-[68px] flex-shrink-0 ${
                  isMissing ? 'text-amber-600 dark:text-amber-400' : 'text-fg-subtle dark:text-fg-subtle-dark'
                }`}>
                  {label}
                </span>

                <select
                  value={currentPaletteId ?? ''}
                  onChange={(e) => handleChange(e.target.value)}
                  className="flex-1 min-w-0 text-[10px] bg-transparent text-fg-muted dark:text-fg-muted-dark border border-bd-base dark:border-bd-base-dark rounded px-1 py-[1px] cursor-pointer appearance-none truncate"
                >
                  <option value="">—</option>
                  {palettes.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option value="__generate__">+ Generate new…</option>
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Collapsible token group ───────────────────────────────────────────────────

function TokenGroupSection({
  group,
  palettes,
  missingRoles,
  onAssign,
}: {
  group: TokenGroup
  palettes: Palette[]
  missingRoles: PaletteRole[]
  onAssign: (tokenId: string, mode: 'light' | 'dark', ref: TokenRef | null) => void
}) {
  const [open, setOpen] = useState(true)

  function tokenIsMissing(token: ThemeToken): boolean {
    return missingRoles.some((role) => token.id.split('/').includes(role))
  }

  const missingCount = group.tokens.filter(tokenIsMissing).length
  const tree = buildTree(group.tokens, group.id)

  function renderLeaf(token: ThemeToken, label: string, connector = false, isLast = false) {
    return (
      <TokenRow
        key={token.id}
        token={token}
        label={label}
        connector={connector}
        isLast={isLast}
        palettes={palettes}
        isMissing={tokenIsMissing(token)}
        onAssign={(mode, ref) => onAssign(token.id, mode, ref)}
      />
    )
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 sticky top-0 bg-surface-sunken dark:bg-surface-sunken-dark z-10 hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors w-full text-left"
      >
        {open
          ? <IconChevronDown size={10} className="text-fg-placeholder dark:text-fg-placeholder-dark flex-shrink-0" />
          : <IconChevronRight size={10} className="text-fg-placeholder dark:text-fg-placeholder-dark flex-shrink-0" />
        }
        <span className="text-[10px] font-semibold text-fg-muted dark:text-fg-muted-dark uppercase tracking-wide flex-1">
          {group.name}
        </span>
        {missingCount > 0 && (
          <span className="text-[9px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
            <IconAlertTriangle size={9} />
            {missingCount}
          </span>
        )}
        <span className="text-[9px] text-fg-placeholder dark:text-fg-placeholder-dark ml-1">
          {group.tokens.length}
        </span>
      </button>

      {open && (
        <div className="pb-1">
          {tree.map((node) => {
            if (node.kind === 'leaf') return renderLeaf(node.token, node.label)

            return (
              <div key={node.label}>
                {/* Branch label */}
                <div className="flex items-center px-3 pt-1.5 pb-0.5">
                  <span className="text-[9px] font-medium text-fg-placeholder dark:text-fg-placeholder-dark uppercase tracking-wider">
                    {node.label}
                  </span>
                </div>
                {/* Children indented, each with its own L-connector */}
                <div style={{ paddingLeft: 14 }}>
                  {node.children.map(({ token, label }, i) =>
                    renderLeaf(token, label, true, i === node.children.length - 1)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

interface Props {
  theme: Theme | null
  palettes: Palette[]
  missingRoles: PaletteRole[]
  onSuggest: () => void
  onAssign: (tokenId: string, mode: 'light' | 'dark', ref: TokenRef | null) => void
  onAssignRole: (role: PaletteRole, paletteId: string) => void
  onGenerateRole: (role: PaletteRole) => void
}

export function TokenEditor({ theme, palettes, missingRoles, onSuggest, onAssign, onAssignRole, onGenerateRole }: Props) {
  if (!theme) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center gap-4 p-8 text-center">
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-medium text-fg-base dark:text-fg-base-dark">No tokens yet</p>
          <p className="text-[11px] text-fg-placeholder dark:text-fg-placeholder-dark max-w-xs">
            Generate a starter token set from your palettes, then adjust the mappings.
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
        <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">Token</span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">L</span>
          <span className="text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark">D</span>
          <button
            onClick={onSuggest}
            title="Re-suggest from current palettes"
            className="flex items-center gap-1 text-[10px] text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-muted dark:hover:text-fg-muted-dark transition-colors ml-1"
          >
            <IconRefresh size={11} />
            Sync
          </button>
        </div>
      </div>

      {/* Role selector */}
      <RoleSelector
        theme={theme}
        palettes={palettes}
        missingRoles={missingRoles}
        onAssignRole={onAssignRole}
        onGenerateRole={onGenerateRole}
      />

      {/* Token groups */}
      <div className="flex-1 overflow-y-auto pb-6">
        {theme.groups.map((group) => (
          <TokenGroupSection
            key={group.id}
            group={group}
            palettes={palettes}
            missingRoles={missingRoles}
            onAssign={onAssign}
          />
        ))}
      </div>
    </div>
  )
}
