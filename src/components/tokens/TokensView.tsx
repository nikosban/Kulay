import { useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { resolveTheme } from '../../lib/tokenResolve'
import { TokenPreview } from './TokenPreview'
import { ComponentDetail, COMPONENTS, type ComponentType } from './ComponentDetail'
import { useTheme } from '../../contexts/ThemeContext'

export function TokensView() {
  const [selected, setSelected] = useState<ComponentType | null>(null)

  const palettes = useProjectStore((s) => s.activeProject?.palettes ?? [])
  const theme    = useProjectStore((s) => s.activeProject?.theme ?? null)
  const { isDark } = useTheme()
  const mode = isDark ? 'dark' : 'light'

  const resolved = theme ? resolveTheme(theme, palettes, mode) : {}

  const m = (l: string, d: string) => isDark ? d : l
  const raisedBg  = resolved['surface/neutral/subtle']  ?? m('#ffffff', '#1c1c1c')
  const border    = resolved['border/default']          ?? m('#e0e0e0', '#333333')
  const textSec   = resolved['fg/muted']                ?? m('#555555', '#aaaaaa')
  const brandSub  = resolved['surface/brand/subtle']    ?? m('#eff6ff', '#1e3a5f')
  const brandText = resolved['fg/brand/base']           ?? m('#1d4ed8', '#93c5fd')

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
      <div style={{
        width: 152, flexShrink: 0,
        backgroundColor: raisedBg, borderLeft: `1px solid ${border}`,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '11px 12px 6px', fontSize: 9, fontWeight: 600, color: textSec, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
          Components
        </div>

        {/* Overview */}
        <div style={{ padding: '0 4px', flexShrink: 0 }}>
          <NavItem
            label="Overview"
            active={selected === null}
            onClick={() => setSelected(null)}
            brandSub={brandSub} brandText={brandText} textSec={textSec}
          />
        </div>

        <div style={{ height: 1, backgroundColor: border, margin: '4px 8px', opacity: 0.5, flexShrink: 0 }} />

        {/* Component list */}
        <div className="flex flex-col overflow-y-auto flex-1" style={{ padding: '0 4px 8px' }}>
          {COMPONENTS.map(({ id, label }) => (
            <NavItem
              key={id}
              label={label}
              active={selected === id}
              onClick={() => setSelected(selected === id ? null : id)}
              brandSub={brandSub} brandText={brandText} textSec={textSec}
            />
          ))}
        </div>
      </div>

    </div>
  )
}

function NavItem({ label, active, onClick, brandSub, brandText, textSec }: {
  label: string; active: boolean; onClick: () => void
  brandSub: string; brandText: string; textSec: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        backgroundColor: active ? brandSub : hovered ? `${brandSub}60` : 'transparent',
        color: active ? brandText : textSec,
        transition: 'background-color 0.1s',
      }}
    >
      {label}
    </button>
  )
}
