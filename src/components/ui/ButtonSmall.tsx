import type { ReactNode, MouseEvent } from 'react'

type Variant = 'default' | 'danger'

interface Props {
  children: ReactNode
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  variant?: Variant
  title?: string
  disabled?: boolean
}

const variantClass: Record<Variant, string> = {
  default: 'text-fg-muted dark:text-fg-muted-dark hover:text-fg-base dark:hover:text-fg-base-dark border-bd-base dark:border-bd-base-dark',
  danger:  'text-fg-placeholder dark:text-fg-placeholder-dark hover:text-fg-danger dark:hover:text-fg-danger-dark border-bd-base dark:border-bd-base-dark',
}

export function ButtonSmall({ children, onClick, variant = 'default', title, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`h-8 px-2 min-w-8 inline-flex items-center justify-center gap-1.5 rounded-md border bg-surface-base dark:bg-surface-base-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClass[variant]}`}
    >
      {children}
    </button>
  )
}
