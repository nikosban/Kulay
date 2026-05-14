import { useProjectStore } from '../../store/useProjectStore'
import { resolveTheme } from '../../lib/tokenResolve'
import { TokenPreview } from './TokenPreview'
import { useTheme } from '../../contexts/ThemeContext'

export function TokensView() {
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

  return <TokenPreview tokens={resolved} mode={mode} />
}
