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
  default: 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border-neutral-200 dark:border-neutral-700',
  danger:  'text-neutral-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 border-neutral-200 dark:border-neutral-700',
}

export function ButtonSmall({ children, onClick, variant = 'default', title, disabled }: Props) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`h-8 px-2 min-w-8 inline-flex items-center justify-center gap-1.5 rounded-md border bg-white dark:bg-neutral-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${variantClass[variant]}`}
    >
      {children}
    </button>
  )
}
