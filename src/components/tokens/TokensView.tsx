import { useState, useRef } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { resolveTheme } from '../../lib/tokenResolve'
import { TokenPreview } from './TokenPreview'
import { ComponentDetail, COMPONENT_GROUPS, type ComponentType } from './ComponentDetail'
import { useTheme } from '../../contexts/ThemeContext'

export function TokensView() {
  const [selected, setSelected] = useState<ComponentType | null>(null)
  const [navWidth, setNavWidth] = useState(180)
  const isResizing = useRef(false)

  function startResize(e: React.MouseEvent) {
    e.preventDefault()
    isResizing.current = true
    const startX = e.clientX
    const startW = navWidth
    function onMove(ev: MouseEvent) {
      if (!isResizing.current) return
      setNavWidth(Math.min(320, Math.max(140, startW + (startX - ev.clientX))))
    }
    function onUp() {
      isResizing.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

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

      {/* Main preview / detail area */}
      <div className="flex flex-1 overflow-hidden">
        {selected
          ? <ComponentDetail type={selected} tokens={resolved} mode={mode} />
          : <TokenPreview tokens={resolved} mode={mode} />
        }
      </div>

      {/* Right component navigator */}
      <div
        className="bg-surface-base dark:bg-surface-base-dark border-l border-bd-base dark:border-bd-base-dark flex flex-col overflow-hidden flex-shrink-0 relative"
        style={{ width: navWidth }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={startResize}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10"
        />
        <div className="px-3 pt-3 pb-1.5 text-[9px] font-semibold text-fg-placeholder dark:text-fg-placeholder-dark uppercase tracking-widest flex-shrink-0">
          Components
        </div>

        {/* Overview */}
        <div className="px-1 flex-shrink-0">
          <NavItem label="Overview" active={selected === null} onClick={() => setSelected(null)} />
        </div>

        <div className="h-px bg-bd-base dark:bg-bd-base-dark mx-2 my-1 flex-shrink-0 opacity-60" />

        {/* Component list */}
        <div className="flex flex-col overflow-y-auto flex-1 px-1 pb-2">
          {COMPONENT_GROUPS.map((group, gi) => (
            <div key={group.label}>
              {gi > 0 && <div className="h-px bg-bd-base dark:bg-bd-base-dark mx-2 my-1 opacity-40" />}
              <div className="px-2 pt-1.5 pb-0.5 text-[9px] font-semibold text-fg-placeholder dark:text-fg-placeholder-dark uppercase tracking-widest opacity-70">
                {group.label}
              </div>
              {group.items.map(({ id, label }) => (
                <NavItem
                  key={id}
                  label={label}
                  active={selected === id}
                  onClick={() => setSelected(selected === id ? null : id)}
                />
              ))}
            </div>
          ))}
        </div>
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
