interface Props {
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export function ConfirmLeaveModal({ onSave, onDiscard, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
        <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">Unsaved changes</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-6">
          You have unsaved changes. Save before leaving?
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSave}
            className="w-full rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium py-2 hover:bg-neutral-700 dark:hover:bg-neutral-200 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onDiscard}
            className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-sm font-medium py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={onCancel}
            className="w-full rounded-lg text-neutral-500 dark:text-neutral-400 text-sm font-medium py-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
