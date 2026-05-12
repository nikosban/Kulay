interface Props {
  isDark: boolean
  onToggle: () => void
  title?: string
}

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M7.5 1.5V2.5M7.5 12.5V13.5M1.5 7.5H2.5M12.5 7.5H13.5M3.4 3.4L4.1 4.1M10.9 10.9L11.6 11.6M3.4 11.6L4.1 10.9M10.9 4.1L11.6 3.4"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12.5 9.5A5.5 5.5 0 0 1 5.5 2.5a5.5 5.5 0 1 0 7 7z"
      stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export function ThemeToggle({ isDark, onToggle, title }: Props) {
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button
      onClick={onToggle}
      title={title ?? label}
      aria-label={label}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-bd-base dark:border-bd-base-dark text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
