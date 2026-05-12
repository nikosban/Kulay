interface Props {
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function ConfirmLeaveModal({ onSave, onDiscard, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-surface-base dark:bg-surface-base-dark rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-semibold text-fg-base dark:text-fg-base-dark mb-2">Unsaved changes</h2>
        <p className="text-sm text-fg-muted dark:text-fg-muted-dark mb-6">
          You have unsaved changes. Save before leaving?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSave}
            className="w-full rounded-lg bg-surface-neutral-strong-rest dark:bg-surface-neutral-strong-rest-dark text-fg-inverted dark:text-fg-inverted-dark text-sm font-medium py-2 hover:bg-surface-neutral-strong-hover dark:hover:bg-surface-neutral-strong-hover-dark transition-colors"
          >
            Save
          </button>
          <button
            onClick={onDiscard}
            className="w-full rounded-lg border border-bd-base dark:border-bd-base-dark text-fg-subtle dark:text-fg-subtle-dark text-sm font-medium py-2 hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-lg text-fg-muted dark:text-fg-muted-dark text-sm font-medium py-2 hover:bg-surface-neutral-subtle-hover dark:hover:bg-surface-neutral-subtle-hover-dark transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
