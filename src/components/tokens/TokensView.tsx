import { useProjectStore } from '../../store/useProjectStore'
import { resolveTheme } from '../../lib/tokenResolve'
import { TokenPreview } from './TokenPreview'
import { ComponentDetail, COMPONENT_GROUPS, type ComponentType } from './ComponentDetail'
import { useTheme } from '../../contexts/ThemeContext'

export function TokensView({ selected }: { selected: ComponentType | null }) {
  const palettes = useProjectStore((s) => s.activeProject?.palettes ?? [])
  const theme    = useProjectStore((s) => s.activeProject?.theme ?? null)
  const { isDark } = useTheme()
  const mode = isDark ? 'dark' : 'light'

  const resolved = theme ? resolveTheme(theme, palettes, mode) : {}

  if (!theme) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-[12px] text-fg-placeholder dark:text-fg-placeholder-dark">
          Generate tokens to see the preview.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {selected
        ? <ComponentDetail type={selected} tokens={resolved} mode={mode} />
        : <TokenPreview tokens={resolved} mode={mode} />
      }
    </div>
  )
}

export function TokenComponentsInspector({ selected, onSelect }: {
  selected: ComponentType | null
  onSelect: (component: ComponentType | null) => void
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-shrink-0 px-2 pt-2">
        <NavItem label="Overview" active={selected === null} onClick={() => onSelect(null)} />
      </div>
      <div className="mx-3 my-1 h-px flex-shrink-0 bg-bd-base opacity-60 dark:bg-bd-base-dark" />
      <div className="flex flex-1 flex-col overflow-y-auto px-2 pb-3">
        {COMPONENT_GROUPS.map((group, groupIndex) => (
          <div key={group.label}>
            {groupIndex > 0 && <div className="mx-1 my-1 h-px bg-bd-base opacity-40 dark:bg-bd-base-dark" />}
            <div className="px-2 pb-0.5 pt-1.5 text-[9px] font-semibold uppercase tracking-widest text-fg-placeholder opacity-70 dark:text-fg-placeholder-dark">
              {group.label}
            </div>
            {group.items.map(({ id, label }) => (
              <NavItem key={id} label={label} active={selected === id} onClick={() => onSelect(selected === id ? null : id)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function NavItem({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors',
        active
          ? 'bg-surface-neutral-subtle-active dark:bg-surface-neutral-subtle-active-dark text-fg-base dark:text-fg-base-dark font-medium'
          : 'text-fg-muted dark:text-fg-muted-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
